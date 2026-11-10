using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Controllers;

/// <summary>Store panel. Every query is scoped to the staff member's own store.</summary>
[ApiController]
[Route("api/store")]
[Authorize(Roles = Roles.StoreStaff)]
public class StoreController(AppDbContext db, DealService deals) : ControllerBase
{
    private static readonly DealStatus[] Live = [DealStatus.Open, DealStatus.Activated];
    public record CodeRequest(string Code);

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        var storeId = User.StoreId();
        var store = await db.Stores.AsNoTracking().FirstAsync(s => s.Id == storeId);

        var interests = await db.DiscountInterests.AsNoTracking()
            .Where(i => i.StoreProduct.StoreId == storeId && i.Status == InterestStatus.Active)
            .Select(i => new { i.StoreProductId, i.MaxPrice }).ToListAsync();

        var products = await db.StoreProducts.AsNoTracking().Where(p => p.StoreId == storeId && p.IsActive)
            .OrderBy(p => p.Id).ToListAsync();
        var liveDeals = await db.Deals.AsNoTracking().Include(d => d.StoreProduct)
            .Where(d => d.StoreProduct.StoreId == storeId && Live.Contains(d.Status)).ToListAsync();
        var redeemed = await db.Commissions.CountAsync(c => c.StoreId == storeId);

        var productRows = products.Select(p =>
        {
            var prices = interests.Where(i => i.StoreProductId == p.Id).ToList();
            var given = prices.Where(i => i.MaxPrice != null).Select(i => i.MaxPrice!.Value).ToList();
            var deal = liveDeals.FirstOrDefault(d => d.StoreProductId == p.Id);
            return new
            {
                p.Id, p.Name, p.RegularPrice, p.ImageUrl,
                interestCount = prices.Count,
                withPrice = given.Count,
                median = Median(given),
                liveDealId = deal?.Id,
            };
        }).OrderByDescending(p => p.interestCount).ThenBy(p => p.Id).ToList();

        return Ok(new
        {
            store = new { store.Id, store.Name, store.City },
            kpis = new
            {
                interested = interests.Count,
                activeDeals = liveDeals.Count,
                reserved = liveDeals.Sum(d => d.ConfirmedCount),
                needed = liveDeals.Sum(d => d.MinReservations),
                redeemed,
            },
            products = productRows,
        });
    }

    /// <summary>Aggregated demand only: counts, buckets, median. Individual buyers are not exposed.</summary>
    [HttpGet("products/{id:int}/demand")]
    public async Task<IActionResult> Demand(int id)
    {
        var storeId = User.StoreId();
        var p = await db.StoreProducts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.StoreId == storeId);
        if (p == null) return NotFound();

        var prices = await db.DiscountInterests
            .Where(i => i.StoreProductId == id && i.Status == InterestStatus.Active)
            .Select(i => i.MaxPrice).ToListAsync();
        var given = prices.Where(x => x != null).Select(x => x!.Value).ToList();

        // Buckets relative to the regular price, e.g. 80 ₾ → ≤50 / 55 / 60 / 65+ / no price.
        var a = Format.RoundTo5(p.RegularPrice * 0.65m);
        var b = Format.RoundTo5(p.RegularPrice * 0.70m);
        var c = Format.RoundTo5(p.RegularPrice * 0.75m);
        var d = Format.RoundTo5(p.RegularPrice * 0.80m);
        var buckets = new[]
        {
            new { label = $"≤{a:0}", count = given.Count(x => x <= a) },
            new { label = $"{b:0}", count = given.Count(x => x > a && x <= b) },
            new { label = $"{c:0}", count = given.Count(x => x > b && x <= c) },
            new { label = $"{d:0}+", count = given.Count(x => x > c) },
            new { label = "ფასის გარეშე", count = prices.Count - given.Count },
        };
        // How many would accept a given offer: count of buyers whose max price ≥ offer. Grouped, never per person.
        var acceptCurve = given.GroupBy(x => x).OrderBy(g => g.Key).Select(g => new { price = g.Key, count = g.Count() });

        return Ok(new
        {
            p.Id, p.Name, p.RegularPrice,
            interestCount = prices.Count, withPrice = given.Count, median = Median(given),
            buckets, priceCounts = acceptCurve,
        });
    }

    [HttpGet("deals")]
    public async Task<IActionResult> Deals()
    {
        var storeId = User.StoreId();
        var list = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).ThenInclude(p => p.Store)
            .Where(d => d.StoreProduct.StoreId == storeId).OrderByDescending(d => d.CreatedAt).ToListAsync();
        return Ok(list.Select(Dto.DealCard));
    }

    [HttpPost("deals")]
    public async Task<IActionResult> Create(NewDealInput input)
    {
        var (deal, error) = await deals.CreateAsync(User.StoreId(), input);
        if (deal == null) return BadRequest(new { error });
        return Ok(new { deal.Id, slug = deal.PublicSlug, error });
    }

    [HttpPost("deals/{id:int}/publish")]
    public async Task<IActionResult> Publish(int id)
    {
        var error = await deals.PublishAsync(User.StoreId(), id);
        return error == null ? Ok() : BadRequest(new { error });
    }

    [HttpPost("redeem/check")]
    public async Task<IActionResult> Check(CodeRequest req) => Ok(await deals.CheckCodeAsync(User.StoreId(), req.Code));

    [HttpPost("redeem")]
    public async Task<IActionResult> Redeem(CodeRequest req) => Ok(await deals.RedeemAsync(User.StoreId(), req.Code, User.Id()));

    /// <summary>Reservations table for one deal (defaults to the store's current live deal).</summary>
    [HttpGet("reservations")]
    public async Task<IActionResult> Reservations([FromQuery] int? dealId)
    {
        var storeId = User.StoreId();
        var deal = await db.Deals.AsNoTracking().Include(d => d.StoreProduct)
            .Where(d => d.StoreProduct.StoreId == storeId && (dealId == null ? Live.Contains(d.Status) : d.Id == dealId))
            .OrderByDescending(d => d.Status == DealStatus.Activated).ThenByDescending(d => d.PublishedAt)
            .FirstOrDefaultAsync();
        if (deal == null) return Ok(new { deal = (object?)null, rows = Array.Empty<object>() });

        var rows = await db.Reservations.AsNoTracking().Include(r => r.User).Include(r => r.PickupCode)
            .Where(r => r.DealId == deal.Id && r.Status != ReservationStatus.Cancelled)
            .OrderByDescending(r => r.CreatedAt).ToListAsync();

        return Ok(new
        {
            deal = new { deal.Id, productName = deal.StoreProduct.Name, deal.Status, deal.ConfirmedCount, deal.MinReservations },
            redeemed = rows.Count(r => r.Status == ReservationStatus.Redeemed),
            waiting = rows.Count(r => r.Status == ReservationStatus.Confirmed),
            rows = rows.Select(r => new { r.Id, phone = Format.MaskPhone(r.User.Phone), r.CreatedAt, r.Source, r.Status }),
        });
    }

    [HttpGet("reports/{dealId:int}")]
    public async Task<IActionResult> Report(int dealId)
    {
        var storeId = User.StoreId();
        var deal = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).ThenInclude(p => p.Store)
            .FirstOrDefaultAsync(d => d.Id == dealId && d.StoreProduct.StoreId == storeId);
        if (deal == null) return NotFound();

        var interestCount = await db.DiscountInterests.CountAsync(i => i.StoreProductId == deal.StoreProductId && i.Status == InterestStatus.Active);
        var res = await db.Reservations.AsNoTracking().Include(r => r.PickupCode)
            .Where(r => r.DealId == dealId).ToListAsync();
        var redeemed = res.Where(r => r.Status == ReservationStatus.Redeemed).ToList();
        var commission = await db.Commissions.Where(c => c.PickupCode.Reservation.DealId == dealId).SumAsync(c => (decimal?)c.Amount) ?? 0;

        return Ok(new
        {
            deal = Dto.DealCard(deal),
            interestCount,
            reservations = new
            {
                confirmed = res.Count(r => r.Status is ReservationStatus.Confirmed or ReservationStatus.Redeemed or ReservationStatus.Expired),
                waitlisted = res.Count(r => r.Status == ReservationStatus.Waitlisted),
                cancelled = res.Count(r => r.Status == ReservationStatus.Cancelled),
            },
            activated = deal.ActivatedAt != null,
            redeemed = redeemed.Count,
            noShows = res.Count(r => r.Status == ReservationStatus.Expired),
            salesBySource = Enum.GetValues<ReservationSource>().Select(s => new { source = s, count = redeemed.Count(r => r.Source == s) }),
            reservationsBySource = Enum.GetValues<ReservationSource>().Select(s => new { source = s, count = res.Count(r => r.Source == s && r.Status != ReservationStatus.Cancelled) }),
            commissionTotal = commission,
            pickupConfirmations = new
            {
                yes = redeemed.Count(r => r.PickupCode?.BuyerConfirmedPickup == true),
                no = redeemed.Count(r => r.PickupCode?.BuyerConfirmedPickup == false),
                noAnswer = redeemed.Count(r => r.PickupCode?.BuyerConfirmedPickup == null),
            },
        });
    }

    private static decimal? Median(List<decimal> values)
    {
        if (values.Count == 0) return null;
        var s = values.OrderBy(x => x).ToList();
        return s.Count % 2 == 1 ? s[s.Count / 2] : (s[s.Count / 2 - 1] + s[s.Count / 2]) / 2;
    }
}
