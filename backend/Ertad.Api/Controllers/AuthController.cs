using System.Security.Claims;
using System.Security.Cryptography;
using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, ISmsSender sms, IWebHostEnvironment env) : ControllerBase
{
    public record OtpRequest(string Phone);
    public record VerifyRequest(string Phone, string Code, string? Name);
    public record StaffLoginRequest(string Email, string Password);

    [HttpPost("otp")]
    public async Task<IActionResult> RequestOtp(OtpRequest req)
    {
        var phone = Format.NormalizePhone(req.Phone);
        if (phone == null) return BadRequest(new { error = "ტელეფონის ნომერი არასწორია" });

        var now = DateTime.UtcNow;
        // Codes live 5 minutes, so ExpiresAt - 5 min is when each was sent.
        var lastSent = await db.OtpCodes.Where(o => o.Phone == phone).MaxAsync(o => (DateTime?)o.ExpiresAt) is { } exp ? exp.AddMinutes(-OtpMinutes) : (DateTime?)null;
        if (lastSent != null && now - lastSent < ResendCooldown)
        {
            var wait = (int)Math.Ceiling((ResendCooldown - (now - lastSent.Value)).TotalSeconds);
            return BadRequest(new { error = $"ახალი კოდი {wait} წამში შეგიძლია მოითხოვო", resendIn = wait });
        }
        var recent = await db.OtpCodes.CountAsync(o => o.Phone == phone && o.ExpiresAt > now.AddMinutes(-5));
        if (recent >= 5) return BadRequest(new { error = "ძალიან ბევრი მცდელობა, სცადე მოგვიანებით" });

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        db.OtpCodes.Add(new OtpCode { Phone = phone, Code = code, ExpiresAt = now.AddMinutes(OtpMinutes) });
        await db.SaveChangesAsync();
        try
        {
            await sms.SendAsync(phone, $"ერთად: შენი კოდია {code}", otp: true);
        }
        catch (SmsException)
        {
            return StatusCode(502, new { error = "SMS ვერ გაიგზავნა, სცადე ცოტა ხანში" });
        }

        // Without a real SMS gateway (dev), the code is returned so you can still log in.
        var devCode = sms is DevSmsSender && env.IsDevelopment() ? code : null;
        return Ok(new { phone, devCode, resendIn = (int)ResendCooldown.TotalSeconds });
    }

    private const int OtpMinutes = 5;
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(VerifyRequest req)
    {
        var phone = Format.NormalizePhone(req.Phone);
        if (phone == null) return BadRequest(new { error = "ტელეფონის ნომერი არასწორია" });

        var otp = await db.OtpCodes.Where(o => o.Phone == phone && o.UsedAt == null && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.Id).FirstOrDefaultAsync();
        if (otp == null || otp.Attempts >= 5) return BadRequest(new { error = "კოდი ვადაგასულია, მოითხოვე ახალი" });
        if (otp.Code != req.Code?.Trim())
        {
            otp.Attempts++;
            await db.SaveChangesAsync();
            return BadRequest(new { error = "კოდი არასწორია" });
        }
        otp.UsedAt = DateTime.UtcNow;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Phone == phone);
        if (user == null)
        {
            user = new User { Phone = phone };
            db.Users.Add(user);
        }
        user.PhoneVerifiedAt ??= DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(req.Name)) user.DisplayInitial = req.Name.Trim()[..1].ToUpperInvariant();
        await db.SaveChangesAsync();

        await SignIn(user.Id, Roles.Buyer, null);
        return Ok(new { ok = true });
    }

    [HttpPost("staff-login")]
    public async Task<IActionResult> StaffLogin(StaffLoginRequest req)
    {
        var staff = await db.StaffUsers.FirstOrDefaultAsync(s => s.Email == req.Email.Trim().ToLower());
        if (staff == null ||
            new PasswordHasher<StaffUser>().VerifyHashedPassword(staff, staff.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
            return BadRequest(new { error = "ელ-ფოსტა ან პაროლი არასწორია" });

        await SignIn(staff.Id, staff.Role == StaffRole.Admin ? Roles.Admin : Roles.StoreStaff, staff.StoreId);
        return Ok(new { role = staff.Role });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return Ok();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        if (User.Identity?.IsAuthenticated != true) return Ok(new { authenticated = false });
        var id = User.Id();
        if (User.IsInRole(Roles.Buyer))
        {
            var u = await db.Users.FindAsync(id);
            if (u == null) return Ok(new { authenticated = false });
            return Ok(new { authenticated = true, role = Roles.Buyer, userId = u.Id, initial = u.DisplayInitial, phone = u.Phone });
        }
        var s = await db.StaffUsers.Include(x => x.Store).FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return Ok(new { authenticated = false });
        return Ok(new
        {
            authenticated = true,
            role = s.Role == StaffRole.Admin ? Roles.Admin : Roles.StoreStaff,
            email = s.Email, storeId = s.StoreId, storeName = s.Store?.Name, storeCity = s.Store?.City,
        });
    }

    private Task SignIn(int id, string role, int? storeId)
    {
        var claims = new List<Claim> { new("uid", id.ToString()), new(ClaimTypes.Role, role) };
        if (storeId != null) claims.Add(new Claim("storeId", storeId.Value.ToString()));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme, "uid", ClaimTypes.Role));
        return HttpContext.SignInAsync(principal, new AuthenticationProperties { IsPersistent = true });
    }
}
