using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Controllers;

/// <summary>The logged-in buyer's own interests and reservations.</summary>
[ApiController]
[Route("api/my")]
[Authorize(Roles = Roles.Buyer)]
public class MyController(AppDbContext db, DealService deals, ISmsSender sms) : ControllerBase
{
    public record PickupAnswer(bool PickedUp);

    private const int MaxCodeResends = 3;
    private static readonly TimeSpan CodeResendCooldown = TimeSpan.FromSeconds(60);

    /// <summary>Sends the buyer's pickup code again by SMS (limited, each SMS costs money).</summary>
    [HttpPost("reservations/{id:int}/resend-code")]
    public async Task<IActionResult> ResendCode(int id)
    {
        var userId = User.Id();
        var r = await db.Reservations.AsNoTracking()
            .Include(x => x.PickupCode).Include(x => x.User)
            .Include(x => x.Deal).ThenInclude(d => d.StoreProduct).ThenInclude(p => p.Store)
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (r == null) return NotFound();
        var code = r.PickupCode;
        if (r.Status != ReservationStatus.Confirmed || code == null || code.RedeemedAt != null || code.ExpiresAt <= DateTime.UtcNow)
            return BadRequest(new { error = "მოქმედი გატანის კოდი არ გაქვს" });

        var sent = await db.NotificationLogs
            .Where(n => n.UserId == userId && n.DealId == r.DealId && n.Type == "CodeResent")
            .Select(n => n.SentAt).ToListAsync();
        if (sent.Count >= MaxCodeResends)
            return BadRequest(new { error = "კოდი უკვე რამდენჯერმე გამოგიგზავნეთ — ის ამ გვერდზეც ჩანს" });
        var since = DateTime.UtcNow - (sent.Count > 0 ? sent.Max() : DateTime.MinValue);
        if (since < CodeResendCooldown)
        {
            var wait = (int)Math.Ceiling((CodeResendCooldown - since).TotalSeconds);
            return BadRequest(new { error = $"თავიდან გაგზავნა {wait} წამში შეიძლება", resendIn = wait });
        }

        var body = $"ერთად: გატანის კოდი {code.Code} — {r.Deal.StoreProduct.Name}, {Format.Money(r.Deal.GroupPrice)}. " +
                   $"გაიტანე {Format.Date(code.ExpiresAt)}-მდე, {r.Deal.StoreProduct.Store.Address}.";
        try { await sms.SendAsync(r.User.Phone, body); }
        catch (SmsException) { return StatusCode(502, new { error = "SMS ვერ გაიგზავნა, სცადე ცოტა ხანში" }); }

        db.NotificationLogs.Add(new NotificationLog { UserId = userId, Type = "CodeResent", DealId = r.DealId, Body = body });
        await db.SaveChangesAsync();
        return Ok(new { remaining = MaxCodeResends - sent.Count - 1, resendIn = (int)CodeResendCooldown.TotalSeconds });
    }

    [HttpGet]
    public async Task<IActionResult> Overview()
    {
        var userId = User.Id();
        var interests = await db.DiscountInterests.AsNoTracking()
            .Where(i => i.UserId == userId && i.Status == InterestStatus.Active)
            .OrderByDescending(i => i.UpdatedAt)
            .Select(i => new
            {
                i.Id, productId = i.StoreProductId, productName = i.StoreProduct.Name, regularPrice = i.StoreProduct.RegularPrice,
                storeId = i.StoreProduct.StoreId, storeName = i.StoreProduct.Store.Name, i.MaxPrice, i.UpdatedAt,
                interestCount = db.DiscountInterests.Count(x => x.StoreProductId == i.StoreProductId && x.Status == InterestStatus.Active),
            }).ToListAsync();

        var reservations = await db.Reservations.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id, r.Status, r.CreatedAt, dealStatus = r.Deal.Status, slug = r.Deal.PublicSlug,
                productName = r.Deal.StoreProduct.Name, storeName = r.Deal.StoreProduct.Store.Name,
                groupPrice = r.Deal.GroupPrice, confirmed = r.Deal.ConfirmedCount, min = r.Deal.MinReservations,
            }).ToListAsync();

        return Ok(new { interests, reservations });
    }

    [HttpGet("reservations/{id:int}")]
    public async Task<IActionResult> Reservation(int id)
    {
        var userId = User.Id();
        var r = await db.Reservations.AsNoTracking()
            .Include(x => x.PickupCode)
            .Include(x => x.Deal).ThenInclude(d => d.StoreProduct).ThenInclude(p => p.Store)
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (r == null) return NotFound();

        var waitlistPosition = r.Status == ReservationStatus.Waitlisted
            ? await db.Reservations.CountAsync(x => x.DealId == r.DealId && x.Status == ReservationStatus.Waitlisted && x.CreatedAt <= r.CreatedAt)
            : (int?)null;

        var code = r.PickupCode;
        var showCode = code != null && r.Status == ReservationStatus.Confirmed;
        return Ok(new
        {
            r.Id, r.Status, r.CreatedAt, waitlistPosition,
            deal = Dto.DealCard(r.Deal),
            store = new { r.Deal.StoreProduct.Store.Address, r.Deal.StoreProduct.Store.MapUrl },
            code = showCode ? code!.Code : null,
            pickupDeadline = code?.ExpiresAt,
            redeemedAt = code?.RedeemedAt,
            buyerConfirmedPickup = code?.BuyerConfirmedPickup,
            saving = r.Deal.RegularPriceSnapshot - r.Deal.GroupPrice,
        });
    }

    [HttpPost("reservations/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var error = await deals.CancelReservationAsync(id, User.Id());
        return error == null ? Ok() : BadRequest(new { error });
    }

    /// <summary>Simulates the buyer's SMS reply "1" / "2" after pickup.</summary>
    [HttpPost("reservations/{id:int}/pickup-answer")]
    public async Task<IActionResult> Answer(int id, PickupAnswer req)
    {
        var userId = User.Id();
        var n = await db.PickupCodes
            .Where(c => c.ReservationId == id && c.Reservation.UserId == userId && c.RedeemedAt != null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.BuyerConfirmedPickup, req.PickedUp));
        return n == 0 ? NotFound() : Ok();
    }
}
