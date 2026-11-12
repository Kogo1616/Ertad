using System.Net.Http.Json;
using System.Text.Json;

namespace Ertad.Api.Services;

public class UbillOptions
{
    public string ApiKey { get; set; } = "";
    /// <summary>ID of your registered and approved sender name (brand) in the ubill panel.</summary>
    public int BrandId { get; set; }
    /// <summary>Send Georgian text in Latin letters: 160 instead of 70 characters per paid SMS part.</summary>
    public bool Transliterate { get; set; } = true;
}

/// <summary>
/// Real SMS through ubill.ge (~0.01 ₾ per SMS, no minimum package).
/// Docs: https://ubill.ge/en/api-docs — POST JSON to /v1/sms/send, API key in the "key" header.
/// </summary>
public class UbillSmsSender(HttpClient http, UbillOptions options, ILogger<UbillSmsSender> log) : ISmsSender
{
    public const string Endpoint = "https://api.ubill.dev/v1/sms/send";

    private static readonly Dictionary<int, string> Errors = new()
    {
        [10] = "brandID not found",
        [20] = "numbers not found",
        [30] = "empty message text",
        [40] = "not enough SMS on balance",
        [47] = "OTP protection rejected the number",
        [50] = "no valid numbers",
        [90] = "JSON error",
        [99] = "general error",
    };

    public async Task SendAsync(string phone, string body, bool otp = false)
    {
        var text = options.Transliterate ? SmsText.ToLatin(body) : body;
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = JsonContent.Create(new
            {
                brandID = options.BrandId,
                numbers = new[] { phone.TrimStart('+') }, // international format without +, e.g. 995599123456
                text,
                stopList = false, // codes and deal updates were requested by the buyer: not advertising
                otp,
            }),
        };
        request.Headers.Add("key", options.ApiKey);

        HttpResponseMessage res;
        try { res = await http.SendAsync(request); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new SmsException("SMS service unreachable", ex);
        }

        var json = await res.Content.ReadAsStringAsync();
        int? status = null;
        string? message = null;
        try
        {
            var root = JsonDocument.Parse(json).RootElement;
            if (root.TryGetProperty("statusID", out var s)) status = s.GetInt32();
            if (root.TryGetProperty("message", out var m)) message = m.GetString();
        }
        catch (JsonException) { /* not JSON */ }

        if (!res.IsSuccessStatusCode || status != 0)
        {
            var reason = status != null && Errors.TryGetValue(status.Value, out var known) ? known : message ?? json;
            log.LogError("ubill {Http} statusID={Status}: {Reason}", (int)res.StatusCode, status, reason);
            throw new SmsException($"ubill error {status}: {reason}");
        }
        log.LogInformation("SMS sent to {Phone} ({Parts} part(s))", Format.MaskPhone(phone), SmsText.Parts(text));
    }
}
