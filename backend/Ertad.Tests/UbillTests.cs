using System.Net;
using System.Text.Json;
using Ertad.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ertad.Tests;

public class UbillTests
{
    private sealed class FakeHandler(HttpStatusCode status, string json) : HttpMessageHandler
    {
        public HttpRequestMessage? Request;
        public JsonElement Body;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct)).RootElement.Clone();
            return new HttpResponseMessage(status) { Content = new StringContent(json) };
        }
    }

    private static UbillSmsSender Sender(FakeHandler h) =>
        new(new HttpClient(h), new UbillOptions { ApiKey = "test-key", BrandId = 7 }, NullLogger<UbillSmsSender>.Instance);

    private const string Ok = """{"statusID":0,"smsID":111,"message":"SMS Sended"}""";

    [Fact]
    public async Task Posts_json_with_key_header_brand_and_international_number()
    {
        var h = new FakeHandler(HttpStatusCode.OK, Ok);
        await Sender(h).SendAsync("+995599112233", "ერთად: შენი კოდია 123456", otp: true);

        Assert.Equal(HttpMethod.Post, h.Request!.Method);
        Assert.Equal(UbillSmsSender.Endpoint, h.Request.RequestUri!.ToString());
        Assert.Equal("test-key", h.Request.Headers.GetValues("key").Single());
        Assert.Equal(7, h.Body.GetProperty("brandID").GetInt32());
        Assert.Equal("995599112233", h.Body.GetProperty("numbers")[0].GetString());
        Assert.Equal("ertad: sheni kodia 123456", h.Body.GetProperty("text").GetString());
        Assert.True(h.Body.GetProperty("otp").GetBoolean());
        Assert.False(h.Body.GetProperty("stopList").GetBoolean());
    }

    [Fact]
    public async Task Notifications_are_not_sent_as_otp()
    {
        var h = new FakeHandler(HttpStatusCode.OK, Ok);
        await Sender(h).SendAsync("+995599112233", "hi");
        Assert.False(h.Body.GetProperty("otp").GetBoolean());
    }

    [Fact]
    public async Task Nonzero_status_becomes_SmsException_even_with_http_200()
    {
        var h = new FakeHandler(HttpStatusCode.OK, """{"statusID":40,"message":"Not enough SMS"}""");
        var ex = await Assert.ThrowsAsync<SmsException>(() => Sender(h).SendAsync("+995599112233", "hi"));
        Assert.Contains("not enough SMS", ex.Message);
    }
}
