using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Controllers;

/// <summary>Public buyer site: stores, products, deals, interest and reservation.</summary>
[ApiController]
[Route("api")]
public class PublicController(AppDbContext db, DealService deals) : ControllerBase
{
    private static readonly DealStatus[] Live = [DealStatus.Open, DealStatus.Activated];

    public record InterestRequest(decimal? MaxPrice);
    public record ReserveRequest(ReservationSource? Source, int? RefUserId);

    private IQueryable<Deal> DealsQuery => db.Deals.AsNoTracking().Include(d => d.StoreProduct).ThenInclude(p => p.Store);

    [HttpGet("stores")]
    public async Task<IActionResult> Stores()
    {
        var now = DateTime.UtcNow;
        var rows = await db.Stores.AsNoTracking().Where(s => s.IsActive)
            .Select(s => new
            {
                s.Id, s.Name, s.City, s.Address, s.MapUrl, s.ImageUrl, s.Description, s.Phone, s.WorkingHours,
                productCount = s.Products.Count(p => p.IsActive),
                activeDeals = db.Deals.Count(d => d.StoreProduct.StoreId == s.Id && Live.Contains(d.Status) && d.ReservationDeadline > now),
                interestCount = db.DiscountInterests.Count(i => i.StoreProduct.StoreId == s.Id && i.Status == InterestStatus.Active),
                bestRatio = db.Deals.Where(d => d.StoreProduct.StoreId == s.Id && Live.Contains(d.Status) && d.ReservationDeadline > now)
                    .Max(d => (decimal?)((d.RegularPriceSnapshot - d.GroupPrice) / d.RegularPriceSnapshot)),
                previewImages = s.Products.Where(p => p.IsActive && p.ImageUrl != null).OrderBy(p => p.Id).Select(p => p.ImageUrl).Take(3).ToList(),
            })
            .ToListAsync();

        return Ok(rows.Select(s => new
        {
            s.Id, s.Name, s.City, s.Address, s.MapUrl, s.ImageUrl, s.Description, s.Phone, s.WorkingHours,
            s.productCount, s.activeDeals, s.interestCount, s.previewImages,
            maxDiscount = s.bestRatio == null ? (int?)null : (int)Math.Round(s.bestRatio.Value * 100),
        }));
    }

    [HttpGet("stores/{id:int}")]
    public async Task<IActionResult> Store(int id)
    {
        var store = await db.Stores.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id && s.IsActive);
        if (store == null) return NotFound();
        var products = await ProductCards(db.StoreProducts.Where(p => p.StoreId == id && p.IsActive));
        return Ok(new { store.Id, store.Name, store.City, store.Address, store.MapUrl, store.ImageUrl, store.Description, store.Phone, store.WorkingHours, products });
    }

    [HttpGet("products")]
    /// <summary>Product search; also feeds the header's live suggestions (?q=…&amp;limit=6).</summary>
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int limit = 60)
    {
        limit = Math.Clamp(limit, 1, 60);
        var query = db.StoreProducts.Where(p => p.IsActive && p.Store.IsActive);
        if (string.IsNullOrWhiteSpace(q))
            return Ok(await ProductCards(query.OrderBy(p => p.Id).Take(limit)));

        var term = q.Trim().ToLower();
        // Best matches first: name starts with the text, then name contains it, then store name matches.
        var ranked = query
            .Where(p => p.Name.ToLower().Contains(term) || p.Store.Name.ToLower().Contains(term))
            .OrderByDescending(p => p.Name.ToLower().StartsWith(term))
            .ThenByDescending(p => p.Name.ToLower().Contains(term))
            .ThenBy(p => p.Name)
            .Take(limit);
        return Ok(await ProductCards(ranked, keepOrder: true));
    }

    private async Task<List<object>> ProductCards(IQueryable<StoreProduct> q, bool keepOrder = false)
    {
        if (!keepOrder) q = q.OrderBy(p => p.Id);
        var rows = await q.AsNoTracking().Select(p => new
        {
            p.Id, p.Name, p.Description, p.ImageUrl, p.RegularPrice, p.StoreId, storeName = p.Store.Name, storeCity = p.Store.City,
            interestCount = db.DiscountInterests.Count(i => i.StoreProductId == p.Id && i.Status == InterestStatus.Active),
            // The product's live group deal, if any: enough for a "before / after" price on the card.
            deal = db.Deals.Where(d => d.StoreProductId == p.Id && Live.Contains(d.Status))
                .Select(d => new
                {
                    slug = d.PublicSlug, d.Status, d.GroupPrice, regularPrice = d.RegularPriceSnapshot,
                    confirmed = d.ConfirmedCount, min = d.MinReservations, d.MaxStock, deadline = d.ReservationDeadline,
                })
                .FirstOrDefault(),
        }).ToListAsync();
        return rows.Cast<object>().ToList();
    }

    /// <summary>Live numbers for the home page. Only counts and sums — nothing about individual buyers.</summary>
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var now = DateTime.UtcNow;
        var taken = db.Reservations.Where(r => r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Redeemed);
        return Ok(new
        {
            activeDeals = await db.Deals.CountAsync(d => Live.Contains(d.Status) && d.ReservationDeadline > now),
            stores = await db.Stores.CountAsync(s => s.IsActive),
            products = await db.StoreProducts.CountAsync(p => p.IsActive && p.Store.IsActive),
            reservations = await taken.CountAsync(),
            saved = await taken.SumAsync(r => (decimal?)(r.Deal.RegularPriceSnapshot - r.Deal.GroupPrice)) ?? 0,
            interested = await db.DiscountInterests.Where(i => i.Status == InterestStatus.Active).Select(i => i.UserId).Distinct().CountAsync(),
        });
    }

    /// <summary>Most requested products (by active buyer requests).</summary>
    [HttpGet("products/popular")]
    public async Task<IActionResult> Popular([FromQuery] int limit = 4)
    {
        limit = Math.Clamp(limit, 1, 24);
        var q = db.StoreProducts.Where(p => p.IsActive && p.Store.IsActive)
            .OrderByDescending(p => db.DiscountInterests.Count(i => i.StoreProductId == p.Id && i.Status == InterestStatus.Active))
            .ThenBy(p => p.Id)
            .Take(limit);
        return Ok(await ProductCards(q, keepOrder: true));
    }

    public record PartnerLeadInput(string? Name, string? StoreName, string? Phone, string? City, string? Message, string? Website);

    /// <summary>"Become a partner" form on the for-stores page. Saved for the admin to follow up.</summary>
    [HttpPost("partner-leads")]
    public async Task<IActionResult> CreatePartnerLead(PartnerLeadInput i)
    {
        // Honeypot: a hidden field real people leave empty; bots fill everything in.
        if (!string.IsNullOrEmpty(i.Website)) return Ok(new { ok = true });
        string? T(string? s, int max) => s?.Trim() is { Length: > 0 } t ? (t.Length > max ? t[..max] : t) : null;
        var name = T(i.Name, 100); var store = T(i.StoreName, 100); var phone = T(i.Phone, 30);
        if (name == null || store == null || phone == null)
            return BadRequest(new { error = "შეავსე სახელი, მაღაზიის სახელი და ტელეფონი" });
        if (Format.NormalizePhone(phone) == null) return BadRequest(new { error = "ტელეფონის ნომერი არასწორია" });

        // Light flood guard: at most 3 applications from one phone per day.
        var dayAgo = DateTime.UtcNow.AddDays(-1);
        if (await db.PartnerLeads.CountAsync(l => l.Phone == phone && l.CreatedAt > dayAgo) >= 3)
            return BadRequest(new { error = "განაცხადი უკვე მიღებულია, მალე დაგიკავშირდებით" });

        db.PartnerLeads.Add(new PartnerLead { Name = name, StoreName = store, Phone = phone, City = T(i.City, 60) ?? "", Message = T(i.Message, 1000) ?? "" });
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpGet("products/{id:int}")]
    public async Task<IActionResult> Product(int id)
    {
        var p = await db.StoreProducts.AsNoTracking().Include(x => x.Store).FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (p == null) return NotFound();

        var active = db.DiscountInterests.Where(i => i.StoreProductId == id && i.Status == InterestStatus.Active);
        var interestCount = await active.CountAsync();
        var initials = await active.OrderByDescending(i => i.CreatedAt).Take(3).Select(i => i.User.DisplayInitial).ToListAsync();

        var buyerId = User.BuyerId();
        // The buyer's own price only — other people's prices are never sent to the browser.
        var mine = buyerId == null ? null
            : await active.Where(i => i.UserId == buyerId).Select(i => new { i.MaxPrice }).FirstOrDefaultAsync();

        var deal = await DealsQuery.FirstOrDefaultAsync(d => d.StoreProductId == id && Live.Contains(d.Status));
        decimal[] factors = [0.70m, 0.75m, 0.85m];
        var suggested = factors.Select(f => Format.RoundTo5(p.RegularPrice * f)).Distinct().OrderBy(x => x).ToList();

        var others = await ProductCards(db.StoreProducts.Where(x => x.StoreId == p.StoreId && x.IsActive && x.Id != id));

        return Ok(new
        {
            p.Id, p.Name, p.Description, p.ImageUrl, p.RegularPrice,
            store = new { p.Store.Id, p.Store.Name, p.Store.City, p.Store.ImageUrl },
            interestCount, initials, suggestedPrices = suggested,
            myInterest = mine == null ? null : new { mine.MaxPrice },
            deal = deal == null ? null : Dto.DealCard(deal),
            others = others.Take(4),
        });
    }

    [Authorize(Roles = Roles.Buyer)]
    [HttpPost("products/{id:int}/interest")]
    public async Task<IActionResult> RequestPrice(int id, InterestRequest req)
    {
        var product = await db.StoreProducts.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (product == null) return NotFound();
        if (req.MaxPrice is <= 0) return BadRequest(new { error = "ფასი უნდა იყოს 0-ზე მეტი" });

        var userId = User.Id();
        var interest = await db.DiscountInterests.FirstOrDefaultAsync(i => i.UserId == userId && i.StoreProductId == id && i.Status == InterestStatus.Active);
        if (interest == null)
        {
            interest = new DiscountInterest { UserId = userId, StoreProductId = id };
            db.DiscountInterests.Add(interest);
        }
        interest.MaxPrice = req.MaxPrice;
        interest.UpdatedAt = DateTime.UtcNow;
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Conflict(new { error = "მოთხოვნა უკვე არსებობს" }); }
        return Ok(new { interest.Id, interest.MaxPrice });
    }

    [Authorize(Roles = Roles.Buyer)]
    [HttpDelete("products/{id:int}/interest")]
    public async Task<IActionResult> WithdrawInterest(int id)
    {
        var userId = User.Id();
        await db.DiscountInterests.Where(i => i.UserId == userId && i.StoreProductId == id && i.Status == InterestStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.Status, InterestStatus.Withdrawn).SetProperty(i => i.UpdatedAt, DateTime.UtcNow));
        return Ok();
    }

    [HttpGet("deals")]
    public async Task<IActionResult> Deals([FromQuery] string? filter)
    {
        var now = DateTime.UtcNow;
        var q = DealsQuery.Where(d => Live.Contains(d.Status) && d.ReservationDeadline > now);
        q = filter switch
        {
            "store" => q.Where(d => d.Origin == DealOrigin.StoreInitiated),
            "requests" => q.Where(d => d.Origin == DealOrigin.FromRequests),
            "ending" => q.Where(d => d.ReservationDeadline <= now.AddHours(48)),
            _ => q,
        };
        var list = filter == "ending"
            ? await q.OrderBy(d => d.ReservationDeadline).ToListAsync()
            : await q.OrderByDescending(d => d.PublishedAt).ToListAsync();
        return Ok(list.Select(Dto.DealCard));
    }

    [HttpGet("deals/{slug}")]
    public async Task<IActionResult> Deal(string slug)
    {
        var d = await DealsQuery.FirstOrDefaultAsync(x => x.PublicSlug == slug && x.Status != DealStatus.Draft);
        if (d == null) return NotFound();

        var participants = await db.Reservations
            .Where(r => r.DealId == d.Id && (r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Redeemed))
            .OrderBy(r => r.CreatedAt).Select(r => r.User.DisplayInitial).Take(50).ToListAsync();

        var buyerId = User.BuyerId();
        var mine = buyerId == null ? null
            : await db.Reservations.Where(r => r.DealId == d.Id && r.UserId == buyerId && r.Status != ReservationStatus.Cancelled)
                .Select(r => new { r.Id, r.Status }).FirstOrDefaultAsync();

        return Ok(new { deal = Dto.DealCard(d), participants, myReservation = mine, myUserId = buyerId });
    }

    [Authorize(Roles = Roles.Buyer)]
    [HttpPost("deals/{slug}/reserve")]
    public async Task<IActionResult> Reserve(string slug, ReserveRequest req)
    {
        var dealId = await db.Deals.Where(d => d.PublicSlug == slug).Select(d => (int?)d.Id).FirstOrDefaultAsync();
        if (dealId == null) return NotFound();

        var refUserId = req.RefUserId != null && await db.Users.AnyAsync(u => u.Id == req.RefUserId) ? req.RefUserId : null;
        var source = req.Source ?? (refUserId != null ? ReservationSource.SharedLink : ReservationSource.StorePage);

        var result = await deals.ReserveAsync(dealId.Value, User.Id(), source, refUserId);
        if (result.Error != null) return BadRequest(new { error = result.Error });
        return Ok(new { result.Reservation!.Id, result.Reservation.Status });
    }
}
