using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Ertad.Tests;

/// <summary>Home page data (stats, popular products) and the partner application form.</summary>
[Collection("db")]
public class HomeTests(PostgresFixture pg)
{
    private async Task<(WebApplicationFactory<Program> Factory, HttpClient Client)> AppAsync(bool demo)
    {
        var cs = await pg.CreateDatabaseAsync();
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
            b.UseSetting("Seed:AdminEmail", "admin@ertad.ge");
            b.UseSetting("Seed:AdminPassword", "Admin123!");
            b.UseSetting("Seed:Demo", demo ? "true" : "false");
        });
        return (factory, factory.CreateClient());
    }

    private record Stats(int ActiveDeals, int Stores, int Products, int Reservations, decimal Saved, int Interested);

    [Fact]
    public async Task Stats_and_popular_products_come_from_the_database()
    {
        var (factory, client) = await AppAsync(demo: true);
        await using var _ = factory;

        // Demo seed: 2 live deals, 1 store, 12 products, 7 + 2 reservations (saving 20 ₾ and 50 ₾ each).
        var s = await client.GetFromJsonAsync<Stats>("/api/stats");
        Assert.Equal(2, s!.ActiveDeals);
        Assert.Equal(1, s.Stores);
        Assert.Equal(12, s.Products);
        Assert.Equal(9, s.Reservations);
        Assert.Equal(7 * 20m + 2 * 50m, s.Saved);
        Assert.True(s.Interested > 0);

        // Most requested first: the blender has 18 requests.
        var popular = await client.GetFromJsonAsync<List<Dictionary<string, object>>>("/api/products/popular?limit=3");
        Assert.Equal(3, popular!.Count);
        Assert.Equal("ბლენდერი 600W", popular[0]["name"].ToString());
    }

    [Fact]
    public async Task Partner_application_is_saved_and_listed_for_admin()
    {
        var (factory, client) = await AppAsync(demo: false);
        await using var _ = factory;

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/partner-leads", new { name = "ნინო" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/partner-leads", new { name = "ნინო", storeName = "ტექნო", phone = "12" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/partner-leads",
            new { name = "ნინო", storeName = "ტექნო სახლი", phone = "599 12 34 56", city = "ქუთაისი", message = "გვინდა პილოტი" })).StatusCode);
        // Honeypot filled → silently ignored.
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/partner-leads",
            new { name = "bot", storeName = "spam", phone = "599 00 00 00", website = "http://spam" })).StatusCode);

        // Admin only.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/partner-leads")).StatusCode);
        (await client.PostAsJsonAsync("/api/auth/staff-login", new { email = "admin@ertad.ge", password = "Admin123!" })).EnsureSuccessStatusCode();
        var leads = await client.GetStringAsync("/api/admin/partner-leads");
        Assert.Contains("ტექნო სახლი", leads);
        Assert.DoesNotContain("spam", leads);
    }
}
