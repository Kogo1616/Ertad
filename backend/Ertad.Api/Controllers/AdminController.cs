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
    public record StoreInput(string? Name, string? City, string? Address, string? MapUrl, decimal CommissionPerItem, bool IsActive,
        string? Description = null, string? Phone = null, string? WorkingHours = null);
    public record ProductInput(int StoreId, string? Name, string? Description, decimal RegularPrice, bool IsActive);
    public record StaffInput(string Email, string Password, StaffRole Role, int? StoreId);

    // ---- stores
    [HttpGet("stores")]
    public async Task<IActionResult> Stores() => Ok(await db.Stores.AsNoTracking().OrderBy(s => s.Id).ToListAsync());

    [HttpPost("stores")]
    public async Task<IActionResult> CreateStore(StoreInput i)
    {
        if (Validate(i) is { } error) return BadRequest(new { error });
        var s = new Store();
        Apply(s, i);
        db.Stores.Add(s);
        await db.SaveChangesAsync();
        return Ok(s);
    }

    [HttpPut("stores/{id:int}")]
    public async Task<IActionResult> UpdateStore(int id, StoreInput i)
    {
        if (Validate(i) is { } error) return BadRequest(new { error });
        var s = await db.Stores.FindAsync(id);
        if (s == null) return NotFound();
        Apply(s, i);
        await db.SaveChangesAsync();
        return Ok(s);
    }

    private const int MaxName = 100;

    private static string? Validate(StoreInput i) =>
        string.IsNullOrWhiteSpace(i.Name) ? "მაღაზიის სახელი სავალდებულოა"
        : i.Name.Trim().Length > MaxName ? $"სახელი მაქსიმუმ {MaxName} სიმბოლო"
        : i.CommissionPerItem < 0 ? "საკომისიო არ შეიძლება იყოს უარყოფითი"
        : (i.Description?.Trim().Length ?? 0) > 500 ? "აღწერა მაქსიმუმ 500 სიმბოლო"
        : (i.Phone?.Trim().Length ?? 0) > 30 ? "ტელეფონი მაქსიმუმ 30 სიმბოლო"
        : (i.WorkingHours?.Trim().Length ?? 0) > 100 ? "სამუშაო საათები მაქსიმუმ 100 სიმბოლო"
        : null;

    private static string? Validate(ProductInput i) =>
        string.IsNullOrWhiteSpace(i.Name) ? "პროდუქტის სახელი სავალდებულოა"
        : i.Name.Trim().Length > MaxName ? $"სახელი მაქსიმუმ {MaxName} სიმბოლო"
        : i.RegularPrice <= 0 ? "ფასი სავალდებულოა და 0-ზე მეტი უნდა იყოს"
        : null;

    private static void Apply(Store s, StoreInput i)
    {
        s.Name = i.Name!.Trim(); s.City = i.City?.Trim() ?? ""; s.Address = i.Address?.Trim() ?? ""; s.MapUrl = i.MapUrl?.Trim() ?? "";
        s.CommissionPerItem = i.CommissionPerItem; s.IsActive = i.IsActive;
        s.Description = i.Description?.Trim() ?? ""; s.Phone = i.Phone?.Trim() ?? ""; s.WorkingHours = i.WorkingHours?.Trim() ?? "";
    }

    // ---- products
    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] int? storeId) =>
        Ok(await db.StoreProducts.AsNoTracking().Where(p => storeId == null || p.StoreId == storeId)
            .OrderBy(p => p.StoreId).ThenBy(p => p.Id)
            .Select(p => new
            {
                p.Id, p.StoreId, p.Name, p.Description, p.RegularPrice, p.ImageUrl, p.IsActive,
                liveDeal = db.Deals.Where(d => d.StoreProductId == p.Id && (d.Status == DealStatus.Open || d.Status == DealStatus.Activated))
                    .Select(d => new { d.Id, slug = d.PublicSlug, d.Status, d.GroupPrice, confirmed = d.ConfirmedCount, min = d.MinReservations, d.MaxStock, deadline = d.ReservationDeadline })
                    .FirstOrDefault(),
            })
            .ToListAsync());

    public record ProductDealInput(decimal GroupPrice, int MinReservations, int MaxStock, int DurationDays, int PickupDays, string? WarrantyTerms);

    /// <summary>Publishes a store-initiated group deal on a product straight from the admin form.</summary>
    [HttpPost("products/{id:int}/deal")]
    public async Task<IActionResult> CreateProductDeal(int id, ProductDealInput i)
    {
        var p = await db.StoreProducts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        if (i.DurationDays is < 1 or > 60) return BadRequest(new { error = "ვადა 1-დან 60 დღემდე" });
        if (await db.Deals.AnyAsync(d => d.StoreProductId == id && (d.Status == DealStatus.Open || d.Status == DealStatus.Activated)))
            return BadRequest(new { error = "ამ პროდუქტზე უკვე არის აქტიური შეთავაზება" });

        var (deal, error) = await deals.CreateAsync(p.StoreId, new NewDealInput(
            id, DealOrigin.StoreInitiated, i.GroupPrice, i.MinReservations, i.MaxStock,
            DateTime.UtcNow.AddDays(i.DurationDays), i.PickupDays, i.WarrantyTerms, Publish: true));
        if (deal == null || error != null) return BadRequest(new { error });
        return Ok(new { deal.Id, slug = deal.PublicSlug });
    }

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(ProductInput i)
    {
        if (Validate(i) is { } error) return BadRequest(new { error });
        if (!await db.Stores.AnyAsync(s => s.Id == i.StoreId)) return BadRequest(new { error = "მაღაზია ვერ მოიძებნა" });
        var p = new StoreProduct { StoreId = i.StoreId, Name = i.Name!.Trim(), Description = i.Description?.Trim() ?? "", RegularPrice = i.RegularPrice, IsActive = i.IsActive };
        db.StoreProducts.Add(p);
        await db.SaveChangesAsync();
        return Ok(new { p.Id });
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, ProductInput i)
    {
        if (Validate(i) is { } error) return BadRequest(new { error });
        var p = await db.StoreProducts.FindAsync(id);
        if (p == null) return NotFound();
        p.Name = i.Name!.Trim(); p.Description = i.Description?.Trim() ?? ""; p.RegularPrice = i.RegularPrice; p.IsActive = i.IsActive;
        await db.SaveChangesAsync();
        return Ok(new { p.Id });
    }

    /// <summary>
    /// Deletes a product that never had a group deal (its buyer requests and photo go with it).
    /// A product with deals is refused: its reservations, sales and reports must stay intact — deactivate it instead.
    /// </summary>
    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var p = await db.StoreProducts.FindAsync(id);
        if (p == null) return NotFound();
        if (await db.Deals.AnyAsync(d => d.StoreProductId == id))
            return Conflict(new { error = "ამ პროდუქტზე შეთავაზება უკვე იყო, ამიტომ წაშლა არ შეიძლება — გამორთე („აქტიური“: არა)" });

        await using var tx = await db.Database.BeginTransactionAsync();
        await db.DiscountInterests.Where(x => x.StoreProductId == id).ExecuteDeleteAsync();
        db.StoreProducts.Remove(p);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        DeleteUpload(p.ImageUrl);
        return Ok();
    }

    [HttpPost("products/{id:int}/image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var p = await db.StoreProducts.FindAsync(id);
        if (p == null) return NotFound();
        var (url, error) = await SaveImageAsync(file, $"p{id}");
        if (error != null) return BadRequest(new { error });
        DeleteUpload(p.ImageUrl);
        p.ImageUrl = url;
        await db.SaveChangesAsync();
        return Ok(new { p.ImageUrl });
    }

    [HttpPost("stores/{id:int}/image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadStoreImage(int id, IFormFile file)
    {
        var s = await db.Stores.FindAsync(id);
        if (s == null) return NotFound();
        var (url, error) = await SaveImageAsync(file, $"s{id}");
        if (error != null) return BadRequest(new { error });
        DeleteUpload(s.ImageUrl);
        s.ImageUrl = url;
        await db.SaveChangesAsync();
        return Ok(new { s.ImageUrl });
    }

    private string UploadDir => Path.Combine(env.ContentRootPath, "wwwroot", "uploads");

    /// <summary>Saves a jpg/png/webp to wwwroot/uploads. The format is detected from the bytes, not the file name.</summary>
    private async Task<(string? Url, string? Error)> SaveImageAsync(IFormFile file, string prefix)
    {
        if (file.Length == 0) return (null, "ფაილი ცარიელია");
        var header = new byte[12];
        await using (var s = file.OpenReadStream()) _ = await s.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
        var ext = DetectImage(header);
        if (ext == null) return (null, "მხოლოდ jpg, png ან webp ფოტო");

        Directory.CreateDirectory(UploadDir);
        var name = $"{prefix}-{Guid.NewGuid():N}{ext}";
        await using (var stream = System.IO.File.Create(Path.Combine(UploadDir, name)))
            await file.CopyToAsync(stream);
        return ($"/uploads/{name}", null);
    }

    /// <summary>Removes a replaced file — only ever our own files inside wwwroot/uploads.</summary>
    private void DeleteUpload(string? url)
    {
        if (url?.StartsWith("/uploads/") != true) return;
        var path = Path.GetFullPath(Path.Combine(UploadDir, Path.GetFileName(url)));
        if (path.StartsWith(Path.GetFullPath(UploadDir)) && System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private static string? DetectImage(byte[] h) =>
        h is [0xFF, 0xD8, 0xFF, ..] ? ".jpg"
        : h is [0x89, 0x50, 0x4E, 0x47, ..] ? ".png"
        : h is [(byte)'R', (byte)'I', (byte)'F', (byte)'F', _, _, _, _, (byte)'W', (byte)'E', (byte)'B', (byte)'P'] ? ".webp"
        : null;

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

    // ---- partner applications
    [HttpGet("partner-leads")]
    public async Task<IActionResult> PartnerLeads() =>
        Ok(await db.PartnerLeads.AsNoTracking().OrderBy(l => l.Handled).ThenByDescending(l => l.CreatedAt).Take(500).ToListAsync());

    [HttpPost("partner-leads/{id:int}/handled")]
    public async Task<IActionResult> MarkLeadHandled(int id, [FromQuery] bool handled = true)
    {
        var n = await db.PartnerLeads.Where(l => l.Id == id).ExecuteUpdateAsync(s => s.SetProperty(l => l.Handled, handled));
        return n == 0 ? NotFound() : Ok();
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications() =>
        Ok(await db.NotificationLogs.AsNoTracking()
            .Join(db.Users, n => n.UserId, u => u.Id, (n, u) => new { n.Id, n.Type, n.DealId, n.Body, n.SentAt, phone = u.Phone })
            .OrderByDescending(n => n.Id).Take(300)
            .ToListAsync());
}
