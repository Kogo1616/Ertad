using System.Text.Json;

namespace Ertad.Api.Services;

public class SenderGeOptions
{
    public string ApiKey { get; set; } = "";
    /// <summary>1 = advertising (adds the SmsNo opt-out), 2 = informational. Codes are informational.</summary>
    public int SmsNo { get; set; } = 2;
    /// <summary>Send Georgian text in Latin letters: 160 instead of 70 characters per paid SMS part.</summary>
    public bool Transliterate { get; set; } = true;
}

/// <summary>
/// Real SMS through sender.ge (Georgian numbers only, ~0.01 ₾ per part).
/// Docs: https://sender.ge/docs/api.php — POST form to /api/send.php.
/// </summary>
public class SenderGeSmsSender(HttpClient http, SenderGeOptions options, ILogger<SenderGeSmsSender> log) : ISmsSender
{
    public const string Endpoint = "https://sender.ge/api/send.php";

    public async Task SendAsync(string phone, string body)
    {
        // sender.ge wants the 9-digit national number, e.g. 555123456.
        if (!phone.StartsWith("+995") || phone.Length != 13)
            throw new SmsException("sender.ge can only send to Georgian mobile numbers");

        var content = options.Transliterate ? SmsText.ToLatin(body) : body;
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["apikey"] = options.ApiKey,
            ["smsno"] = options.SmsNo.ToString(),
            ["destination"] = phone[4..],
            ["content"] = content,
        });

        HttpResponseMessage res;
        try { res = await http.PostAsync(Endpoint, form); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new SmsException("SMS service unreachable", ex);
        }

        var json = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            string? message = null;
            try { message = JsonDocument.Parse(json).RootElement.GetProperty("message").GetString(); } catch { /* not JSON */ }
            log.LogError("sender.ge {Status}: {Message}", (int)res.StatusCode, message ?? json);
            throw new SmsException($"sender.ge error {(int)res.StatusCode}: {message ?? "unknown"}");
        }
        log.LogInformation("SMS sent to {Phone} ({Parts} part(s))", Format.MaskPhone(phone), SmsText.Parts(content));
    }
}

public class SmsException(string message, Exception? inner = null) : Exception(message, inner);
