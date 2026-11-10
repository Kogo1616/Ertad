using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Controllers;

/// <summary>Platform admin: stores, catalog, staff accounts, deals, notification log.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController(AppDbContext db, DealService deals, IWebHostEnvironment env) : ControllerBase
{
    public record StoreInput(string Name, string City, string Address, string MapUrl, decimal CommissionPerItem, bool IsActive);
    public record ProductInput(int StoreId, string Name, string Description, decimal RegularPrice, bool IsActive);
    public record StaffInput(string Email, string Password, StaffRole Role, int? StoreId);

    // ---- stores
    [HttpGet("stores")]
    public async Task<IActionResult> Stores() => Ok(await db.Stores.AsNoTracking().OrderBy(s => s.Id).ToListAsync());

    [HttpPost("stores")]
    public async Task<IActionResult> CreateStore(StoreInput i)
    {
        var s = new Store();
        Apply(s, i);
        db.Stores.Add(s);
        await db.SaveChangesAsync();
        return Ok(s);
    }

    [HttpPut("stores/{id:int}")]
    public async Task<IActionResult> UpdateStore(int id, StoreInput i)
    {
        var s = await db.Stores.FindAsync(id);
        if (s == null) return NotFound();
        Apply(s, i);
        await db.SaveChangesAsync();
        return Ok(s);
    }

    private static void Apply(Store s, StoreInput i)
    {
        s.Name = i.Name.Trim(); s.City = i.City.Trim(); s.Address = i.Address.Trim(); s.MapUrl = i.MapUrl.Trim();
        s.CommissionPerItem = i.CommissionPerItem; s.IsActive = i.IsActive;
    }

    // ---- products
    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] int? storeId) =>
        Ok(await db.StoreProducts.AsNoTracking().Where(p => storeId == null || p.StoreId == storeId)
            .OrderBy(p => p.StoreId).ThenBy(p => p.Id)
            .Select(p => new { p.Id, p.StoreId, p.Name, p.Description, p.RegularPrice, p.ImageUrl, p.IsActive })
            .ToListAsync());

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(ProductInput i)
    {
        if (!await db.Stores.AnyAsync(s => s.Id == i.StoreId)) return BadRequest(new { error = "მაღაზია ვერ მოიძებნა" });
        var p = new StoreProduct { StoreId = i.StoreId, Name = i.Name.Trim(), Description = i.Description.Trim(), RegularPrice = i.RegularPrice, IsActive = i.IsActive };
        db.StoreProducts.Add(p);
        await db.SaveChangesAsync();
        return Ok(new { p.Id });
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, ProductInput i)
    {
        var p = await db.StoreProducts.FindAsync(id);
        if (p == null) return NotFound();
        p.Name = i.Name.Trim(); p.Description = i.Description.Trim(); p.RegularPrice = i.RegularPrice; p.IsActive = i.IsActive;
        await db.SaveChangesAsync();
        return Ok(new { p.Id });
    }

    [HttpPost("products/{id:int}/image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var p = await db.StoreProducts.FindAsync(id);
        if (p == null) return NotFound();
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp")) return BadRequest(new { error = "მხოლოდ jpg, png ან webp" });

        var name = $"p{id}-{Guid.NewGuid():N}{ext}";
        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads");
        Directory.CreateDirectory(dir);
        await using (var stream = System.IO.File.Create(Path.Combine(dir, name)))
            await file.CopyToAsync(stream);
        p.ImageUrl = $"/uploads/{name}";
        await db.SaveChangesAsync();
        return Ok(new { p.ImageUrl });
    }

    // ---- staff
    [HttpGet("staff")]
    public async Task<IActionResult> Staff() =>
        Ok(await db.StaffUsers.AsNoTracking().OrderBy(s => s.Id)
            .Select(s => new { s.Id, s.Email, s.Role, s.StoreId, storeName = s.Store != null ? s.Store.Name : null }).ToListAsync());

    [HttpPost("staff")]
    public async Task<IActionResult> CreateStaff(StaffInput i)
    {
        var email = i.Email.Trim().ToLower();
        if (i.Password.Length < 8) return BadRequest(new { error = "პაროლი მინიმუმ 8 სიმბოლო" });
        if (i.Role == StaffRole.StoreStaff && i.StoreId == null) return BadRequest(new { error = "აირჩიე მაღაზია" });
        if (await db.StaffUsers.AnyAsync(s => s.Email == email)) return BadRequest(new { error = "ეს ელ-ფოსტა უკვე არსებობს" });

        var s = new StaffUser { Email = email, Role = i.Role, StoreId = i.Role == StaffRole.StoreStaff ? i.StoreId : null };
        s.PasswordHash = new PasswordHasher<StaffUser>().HashPassword(s, i.Password);
        db.StaffUsers.Add(s);
        await db.SaveChangesAsync();
        return Ok(new { s.Id });
    }

    // ---- deals & notifications
    [HttpGet("deals")]
    public async Task<IActionResult> Deals()
    {
        var list = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).ThenInclude(p => p.Store)
            .OrderByDescending(d => d.CreatedAt).ToListAsync();
        return Ok(list.Select(Dto.DealCard));
    }

    [HttpPost("deals/{id:int}/cancel")]
    public async Task<IActionResult> CancelDeal(int id)
    {
        var name = await db.Deals.Where(d => d.Id == id).Select(d => d.StoreProduct.Name).FirstOrDefaultAsync();
        if (name == null) return NotFound();
        await deals.FailDealAsync(id, $"ერთად: {name} — შეთავაზება გაუქმდა. ჯავშანი გაუქმებულია, არაფერი გადაგიხდია.");
        return Ok();
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications() =>
        Ok(await db.NotificationLogs.AsNoTracking()
            .Join(db.Users, n => n.UserId, u => u.Id, (n, u) => new { n.Id, n.Type, n.DealId, n.Body, n.SentAt, phone = u.Phone })
            .OrderByDescending(n => n.Id).Take(300)
            .ToListAsync());
}
