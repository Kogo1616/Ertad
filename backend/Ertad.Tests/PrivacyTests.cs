using Microsoft.AspNetCore.Mvc.Testing;

namespace Ertad.Tests;

/// <summary>Buyers must never see other people's max prices — not in JSON, not in HTML.</summary>
[Collection("db")]
public class PrivacyTests(PostgresFixture pg)
{
    [Fact]
    public async Task Public_endpoints_never_expose_max_prices()
    {
        var cs = await pg.CreateDatabaseAsync();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
            b.UseSetting("Seed:Demo", "true");
        });
        var client = factory.CreateClient(); // app start runs migrations + demo seed (blender has 12 max prices)

        string[] urls = ["/api/products/1", "/api/stores/1", "/api/products?q=ბლ", "/api/deals", "/api/deals/blender-60", "/"];
        foreach (var url in urls)
        {
            var res = await client.GetAsync(url);
            var body = await res.Content.ReadAsStringAsync();
            Assert.True(res.IsSuccessStatusCode || url == "/", $"{url} → {(int)res.StatusCode}");
            Assert.DoesNotContain("maxPrice", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("median", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("priceCounts", body, StringComparison.OrdinalIgnoreCase);
        }

        // The store aggregates require a staff login.
        Assert.Equal(401, (int)(await client.GetAsync("/api/store/products/1/demand")).StatusCode);
    }
}
