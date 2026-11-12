using System.Text;

namespace Ertad.Api.Services;

/// <summary>
/// Makes SMS text cheap to send. Georgian script forces UCS-2 encoding (70 characters per SMS part);
/// plain Latin fits the GSM-7 alphabet (160 per part), so the same message costs 2–3× less.
/// </summary>
public static class SmsText
{
    // Common Georgian Latin transliteration, as people write in SMS.
    private static readonly Dictionary<char, string> Map = new()
    {
        ['ა'] = "a", ['ბ'] = "b", ['გ'] = "g", ['დ'] = "d", ['ე'] = "e", ['ვ'] = "v", ['ზ'] = "z",
        ['თ'] = "t", ['ი'] = "i", ['კ'] = "k", ['ლ'] = "l", ['მ'] = "m", ['ნ'] = "n", ['ო'] = "o",
        ['პ'] = "p", ['ჟ'] = "zh", ['რ'] = "r", ['ს'] = "s", ['ტ'] = "t", ['უ'] = "u", ['ფ'] = "p",
        ['ქ'] = "k", ['ღ'] = "gh", ['ყ'] = "y", ['შ'] = "sh", ['ჩ'] = "ch", ['ც'] = "ts", ['ძ'] = "dz",
        ['წ'] = "ts", ['ჭ'] = "ch", ['ხ'] = "kh", ['ჯ'] = "j", ['ჰ'] = "h",
        ['₾'] = "GEL", ['—'] = "-", ['–'] = "-", ['„'] = "\"", ['“'] = "\"", ['”'] = "\"", ['…'] = "...", ['·'] = "-",
    };

    /// <summary>Georgian → Latin; anything else outside plain ASCII is dropped.</summary>
    public static string ToLatin(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            if (Map.TryGetValue(ch, out var latin)) sb.Append(latin);
            else if (ch < 128) sb.Append(ch);
        }
        // Collapse double spaces left behind by dropped characters.
        return System.Text.RegularExpressions.Regex.Replace(sb.ToString(), " {2,}", " ").Trim();
    }

    /// <summary>Number of SMS parts the text will be billed as.</summary>
    public static int Parts(string text)
    {
        var gsm = text.All(c => c < 128);
        int single = gsm ? 160 : 70, multi = gsm ? 153 : 67;
        return text.Length <= single ? 1 : (int)Math.Ceiling(text.Length / (double)multi);
    }
}
