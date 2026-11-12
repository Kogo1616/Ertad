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
