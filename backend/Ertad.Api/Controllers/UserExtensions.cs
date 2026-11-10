using System.Security.Claims;

namespace Ertad.Api.Controllers;

public static class Roles
{
    public const string Buyer = "Buyer";
    public const string StoreStaff = "StoreStaff";
    public const string Admin = "Admin";
}

public static class UserExtensions
{
    public static int Id(this ClaimsPrincipal u) => int.Parse(u.FindFirstValue("uid")!);

    public static int? BuyerId(this ClaimsPrincipal u) =>
        u.IsInRole(Roles.Buyer) && int.TryParse(u.FindFirstValue("uid"), out var id) ? id : null;

    public static int StoreId(this ClaimsPrincipal u) => int.Parse(u.FindFirstValue("storeId")!);
}
