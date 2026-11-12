using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Ertad.Tests;

/// <summary>The real-data path: empty database → admin adds store, product, staff → staff sees the catalog.</summary>
[Collection("db")]
public class AdminTests(PostgresFixture pg)
{
    private record Created(int Id);

    private async Task<(WebApplicationFactory<Program> Factory, HttpClient Admin, string Cs)> AdminClientAsync()
    {
        var cs = await pg.CreateDatabaseAsync();
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
        });
        var admin = factory.CreateClient();
        (await admin.PostAsJsonAsync("/api/auth/staff-login", new { email = "admin@ertad.ge", password = "Admin123!" })).EnsureSuccessStatusCode();
        return (factory, admin, cs);
    }

    [Fact]
    public async Task Admin_can_publish_a_group_deal_from_the_product_form()
    {
        var (factory, admin, _) = await AdminClientAsync();
        await using var _f = factory;
        var store = await (await admin.PostAsJsonAsync("/api/admin/stores", new { name = "მაღაზია", commissionPerItem = 5, isActive = true })).Content.ReadFromJsonAsync<Created>();
        var product = await (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store!.Id, name = "ბლენდერი", regularPrice = 80, isActive = true })).Content.ReadFromJsonAsync<Created>();

        // Group price must be below the regular price.
        var tooHigh = await admin.PostAsJsonAsync($"/api/admin/products/{product!.Id}/deal", new { groupPrice = 80, minReservations = 10, maxStock = 20, durationDays = 7, pickupDays = 3 });
        Assert.Equal(HttpStatusCode.BadRequest, tooHigh.StatusCode);

        var ok = await admin.PostAsJsonAsync($"/api/admin/products/{product.Id}/deal", new { groupPrice = 60, minReservations = 10, maxStock = 20, durationDays = 7, pickupDays = 3, warrantyTerms = "1 წელი" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        // Only one live deal per product.
        var second = await admin.PostAsJsonAsync($"/api/admin/products/{product.Id}/deal", new { groupPrice = 55, minReservations = 5, maxStock = 10, durationDays = 3, pickupDays = 3 });
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);

        // The public catalog and the deals list show the before/after price.
        var catalog = await admin.GetStringAsync($"/api/stores/{store.Id}");
        Assert.Contains("\"groupPrice\":60", catalog);
        Assert.Contains("\"regularPrice\":80", catalog);
        Assert.Contains("\"min\":10", catalog);
        Assert.Contains("ბლენდერი", await admin.GetStringAsync("/api/deals"));
        Assert.Contains("\"liveDeal\":{", await admin.GetStringAsync("/api/admin/products"));
    }

    [Fact]
    public async Task Names_and_price_are_required()
    {
        var (factory, admin, _) = await AdminClientAsync();
        await using var _f = factory;

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/stores", new { name = "  ", city = "ქუთაისი", commissionPerItem = 5, isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/stores", new { city = "ქუთაისი", commissionPerItem = 5, isActive = true })).StatusCode);
        var store = await (await admin.PostAsJsonAsync("/api/admin/stores", new { name = "მაღაზია", isActive = true, commissionPerItem = 5 })).Content.ReadFromJsonAsync<Created>();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store!.Id, name = "", regularPrice = 10, isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store.Id, name = "ჩაიდანი", regularPrice = 0, isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store.Id, name = "ჩაიდანი", regularPrice = 65, isActive = true })).StatusCode);
    }

    [Fact]
    public async Task Product_without_deals_can_be_deleted_but_not_one_with_a_deal()
    {
        var (factory, admin, cs) = await AdminClientAsync();
        await using var _f = factory;
        var store = await (await admin.PostAsJsonAsync("/api/admin/stores", new { name = "მაღაზია", commissionPerItem = 5, isActive = true })).Content.ReadFromJsonAsync<Created>();
        var free = await (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store!.Id, name = "ტოსტერი", regularPrice = 70, isActive = true })).Content.ReadFromJsonAsync<Created>();
        var used = await (await admin.PostAsJsonAsync("/api/admin/products", new { storeId = store.Id, name = "ბლენდერი", regularPrice = 80, isActive = true })).Content.ReadFromJsonAsync<Created>();

        // A buyer request on the deletable product goes with it.
        await using (var db = PostgresFixture.NewContext(cs))
        {
            var user = new Ertad.Api.Domain.User { Phone = "+995599000777", PhoneVerifiedAt = DateTime.UtcNow };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            db.DiscountInterests.Add(new Ertad.Api.Domain.DiscountInterest { UserId = user.Id, StoreProductId = free!.Id, MaxPrice = 55 });
            await db.SaveChangesAsync();
        }

        // The other product gets a (draft) deal from the store.
        (await admin.PostAsJsonAsync("/api/admin/staff", new { email = "s@example.ge", password = "Shop12345", role = "StoreStaff", storeId = store.Id })).EnsureSuccessStatusCode();
        var staff = factory.CreateClient();
        (await staff.PostAsJsonAsync("/api/auth/staff-login", new { email = "s@example.ge", password = "Shop12345" })).EnsureSuccessStatusCode();
        (await staff.PostAsJsonAsync("/api/store/deals", new
        {
            storeProductId = used!.Id, origin = "StoreInitiated", groupPrice = 60, minReservations = 5, maxStock = 10,
            reservationDeadline = DateTime.UtcNow.AddDays(3), pickupDays = 3, warrantyTerms = "", publish = false,
        })).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/products/{free!.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/admin/products/{used.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/admin/products/{free.Id}")).StatusCode);

        var list = await admin.GetStringAsync("/api/admin/products");
        Assert.DoesNotContain("ტოსტერი", list);
        Assert.Contains("ბლენდერი", list);
        await using (var db = PostgresFixture.NewContext(cs))
            Assert.Equal(0, db.DiscountInterests.Count());
    }

    [Fact]
    public async Task Admin_can_set_up_a_store_from_an_empty_database()
    {
        var cs = await pg.CreateDatabaseAsync();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
            // Seed:Demo is off by default: only the admin account exists.
        });
        var admin = factory.CreateClient();

        Assert.Empty(await admin.GetFromJsonAsync<object[]>("/api/stores") ?? []);
        (await admin.PostAsJsonAsync("/api/auth/staff-login", new { email = "admin@ertad.ge", password = "Admin123!" })).EnsureSuccessStatusCode();

        var store = await (await admin.PostAsJsonAsync("/api/admin/stores", new
        {
            name = "ტექნო სახლი", city = "ქუთაისი", address = "რუსთაველის 10", mapUrl = "https://maps.google.com/?q=Kutaisi",
            commissionPerItem = 5, isActive = true,
        })).Content.ReadFromJsonAsync<Created>();

        var product = await admin.PostAsJsonAsync("/api/admin/products", new
        {
            storeId = store!.Id, name = "ბლენდერი", description = "600W", regularPrice = 80, isActive = true,
        });
        product.EnsureSuccessStatusCode();

        (await admin.PostAsJsonAsync("/api/admin/staff", new
        {
            email = "shop@example.ge", password = "Shop12345", role = "StoreStaff", storeId = store.Id,
        })).EnsureSuccessStatusCode();

        // Photo upload: a real PNG is accepted, a renamed text file is not.
        var productId = (await product.Content.ReadFromJsonAsync<Created>())!.Id;
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0];
        var good = new MultipartFormDataContent { { new ByteArrayContent(png), "file", "photo.png" } };
        var up = await admin.PostAsync($"/api/admin/products/{productId}/image", good);
        Assert.Equal(HttpStatusCode.OK, up.StatusCode);
        var url = (await up.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["imageUrl"];
        Assert.Matches(@"^/uploads/p\d+-[0-9a-f]{32}\.png$", url);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(url)).StatusCode);
        var env = factory.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        File.Delete(Path.Combine(env.ContentRootPath, "wwwroot", url.TrimStart('/'))); // don't leave test files in uploads/

        var fake = new MultipartFormDataContent { { new ByteArrayContent("not an image"u8.ToArray()), "file", "evil.jpg" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync($"/api/admin/products/{productId}/image", fake)).StatusCode);

        // Store photo: same rules, shown on the public store list.
        var storeUp = await admin.PostAsync($"/api/admin/stores/{store.Id}/image",
            new MultipartFormDataContent { { new ByteArrayContent(png), "file", "logo.png" } });
        Assert.Equal(HttpStatusCode.OK, storeUp.StatusCode);
        var storeUrl = (await storeUp.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["imageUrl"];
        Assert.Matches(@"^/uploads/s\d+-[0-9a-f]{32}\.png$", storeUrl);
        Assert.Contains(storeUrl, await admin.GetStringAsync("/api/stores"));
        File.Delete(Path.Combine(env.ContentRootPath, "wwwroot", storeUrl.TrimStart('/')));
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync($"/api/admin/stores/{store.Id}/image",
            new MultipartFormDataContent { { new ByteArrayContent("nope"u8.ToArray()), "file", "logo.png" } })).StatusCode);

        // Public site shows the new store and product.
        var publicStore = await admin.GetFromJsonAsync<Dictionary<string, object>>($"/api/stores/{store.Id}");
        Assert.Contains("ბლენდერი", publicStore!["products"].ToString());

        // The new staff account logs in and sees its store's dashboard.
        var staff = factory.CreateClient();
        (await staff.PostAsJsonAsync("/api/auth/staff-login", new { email = "shop@example.ge", password = "Shop12345" })).EnsureSuccessStatusCode();
        var dash = await staff.GetAsync("/api/store/dashboard");
        Assert.Equal(HttpStatusCode.OK, dash.StatusCode);
        Assert.Contains("ტექნო სახლი", await dash.Content.ReadAsStringAsync());
    }
}
