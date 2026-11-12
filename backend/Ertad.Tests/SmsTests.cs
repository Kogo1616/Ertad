using System.Net;
using System.Net.Http.Json;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ertad.Tests;

public class SmsTextTests
{
    [Fact]
    public void Georgian_is_transliterated_to_cheap_latin()
    {
        var latin = SmsText.ToLatin("ერთად: შენი კოდია 482719 — 60 ₾");
        Assert.Equal("ertad: sheni kodia 482719 - 60 GEL", latin);
        Assert.All(latin, c => Assert.True(c < 128));
    }

    [Fact]
    public void Latin_fits_more_characters_per_paid_part()
    {
        var georgian = new string('ა', 100);
        Assert.Equal(2, SmsText.Parts(georgian));                  // UCS-2: 70 per part
        Assert.Equal(1, SmsText.Parts(SmsText.ToLatin(georgian))); // GSM-7: 160 per part
    }
}

public class SenderGeTests
{
    private sealed class FakeHandler(HttpStatusCode status, string json) : HttpMessageHandler
    {
        public Dictionary<string, string> Form = [];
        public Uri? Url;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Url = request.RequestUri;
            var body = await request.Content!.ReadAsStringAsync(ct);
            Form = body.Split('&').Select(p => p.Split('=')).ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1].Replace('+', ' ')));
            return new HttpResponseMessage(status) { Content = new StringContent(json) };
        }
    }

    private static SenderGeSmsSender Sender(FakeHandler h, bool transliterate = true) =>
        new(new HttpClient(h), new SenderGeOptions { ApiKey = "test-key", SmsNo = 2, Transliterate = transliterate }, NullLogger<SenderGeSmsSender>.Instance);

    [Fact]
    public async Task Posts_form_with_national_number_and_latin_text()
    {
        var h = new FakeHandler(HttpStatusCode.OK, """{"data":[{"messageId":"x","statusId":1,"qnt":1}]}""");
        await Sender(h).SendAsync("+995599112233", "ერთად: შენი კოდია 123456");

        Assert.Equal(SenderGeSmsSender.Endpoint, h.Url!.ToString());
        Assert.Equal("test-key", h.Form["apikey"]);
        Assert.Equal("2", h.Form["smsno"]);
        Assert.Equal("599112233", h.Form["destination"]);
        Assert.Equal("ertad: sheni kodia 123456", h.Form["content"]);
    }

    [Fact]
    public async Task Priority_is_sent_only_when_configured()
    {
        var ok = """{"data":[{"messageId":"x","statusId":1,"qnt":1}]}""";
        var without = new FakeHandler(HttpStatusCode.OK, ok);
        await Sender(without).SendAsync("+995599112233", "hi");
        Assert.False(without.Form.ContainsKey("priority"));

        var with = new FakeHandler(HttpStatusCode.OK, ok);
        var sender = new SenderGeSmsSender(new HttpClient(with), new SenderGeOptions { ApiKey = "k", Priority = 1 }, NullLogger<SenderGeSmsSender>.Instance);
        await sender.SendAsync("+995599112233", "hi");
        Assert.Equal("1", with.Form["priority"]);
    }

    [Fact]
    public async Task Provider_error_becomes_SmsException()
    {
        var h = new FakeHandler(HttpStatusCode.PaymentRequired, """{"message":"overdraft"}""");
        var ex = await Assert.ThrowsAsync<SmsException>(() => Sender(h).SendAsync("+995599112233", "hi"));
        Assert.Contains("overdraft", ex.Message);
    }

    [Fact]
    public async Task Non_georgian_numbers_are_rejected_without_calling_the_api()
    {
        var h = new FakeHandler(HttpStatusCode.OK, "{}");
        await Assert.ThrowsAsync<SmsException>(() => Sender(h).SendAsync("+491701234567", "hi"));
        Assert.Null(h.Url);
    }
}

[Collection("db")]
public class ResendTests(PostgresFixture pg)
{
    private record OtpResponse(string? DevCode, int ResendIn);
    private record ErrorResponse(string Error, int? ResendIn);

    [Fact]
    public async Task Login_code_can_be_resent_only_after_the_cooldown()
    {
        var cs = await pg.CreateDatabaseAsync();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
        });
        var client = factory.CreateClient();

        var first = await client.PostAsJsonAsync("/api/auth/otp", new { phone = "599 77 66 55" });
        first.EnsureSuccessStatusCode();
        Assert.Equal(60, (await first.Content.ReadFromJsonAsync<OtpResponse>())!.ResendIn);

        var again = await client.PostAsJsonAsync("/api/auth/otp", new { phone = "599776655" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        var err = await again.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.InRange(err!.ResendIn ?? 0, 1, 60);
    }

    [Fact]
    public async Task Pickup_code_resend_is_limited()
    {
        var cs = await pg.CreateDatabaseAsync();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", cs);
            b.UseSetting("Jobs:Enabled", "false");
        });
        var client = factory.CreateClient();

        // Log in as a new buyer and join the seeded coffee deal (min 6) → confirmed, no code yet.
        var otp = await (await client.PostAsJsonAsync("/api/auth/otp", new { phone = "599000111" })).Content.ReadFromJsonAsync<OtpResponse>();
        (await client.PostAsJsonAsync("/api/auth/verify", new { phone = "599000111", code = otp!.DevCode })).EnsureSuccessStatusCode();
        var res = await (await client.PostAsJsonAsync("/api/deals/coffee-210/reserve", new { source = "DealsList" })).Content.ReadFromJsonAsync<Dictionary<string, object>>();
        var id = res!["id"].ToString();

        // No pickup code before the group fills.
        var early = await client.PostAsync($"/api/my/reservations/{id}/resend-code", null);
        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);

        // Fill the group directly so a code is issued.
        await using (var db = PostgresFixture.NewContext(cs))
        {
            var dealId = db.Deals.Single(d => d.PublicSlug == "coffee-210").Id;
            foreach (var u in db.Users.Where(u => u.Phone.StartsWith("+99555500")).Take(3).Select(u => u.Id).ToList())
                await TestData.ReserveAsync(cs, dealId, u);
        }

        var ok = await client.PostAsync($"/api/my/reservations/{id}/resend-code", null);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var tooSoon = await client.PostAsync($"/api/my/reservations/{id}/resend-code", null);
        Assert.Equal(HttpStatusCode.BadRequest, tooSoon.StatusCode);
        Assert.NotNull((await tooSoon.Content.ReadFromJsonAsync<ErrorResponse>())!.ResendIn);
    }
}
