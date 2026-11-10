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
public class MyController(AppDbContext db, DealService deals) : ControllerBase
{
    public record PickupAnswer(bool PickedUp);

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
