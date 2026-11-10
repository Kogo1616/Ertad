using System.Text.RegularExpressions;

namespace Ertad.Api.Services;

public static class Format
{
    private static readonly TimeZoneInfo Tbilisi = FindTbilisi();

    private static TimeZoneInfo FindTbilisi()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Tbilisi"); }
        catch { return TimeZoneInfo.CreateCustomTimeZone("Tbilisi", TimeSpan.FromHours(4), "Tbilisi", "Tbilisi"); }
    }

    public static string Money(decimal v) => $"{v:0.##} ₾";

    private static readonly string[] Days = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
    private static readonly string[] Months = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];

    /// <summary>"პარასკევი, 14 ნოე, 18:00" in Tbilisi time (names hard-coded, no OS locale needed).</summary>
    public static string Date(DateTime utc)
    {
        var t = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Tbilisi);
        return $"{Days[(int)t.DayOfWeek]}, {t.Day} {Months[t.Month - 1]}, {t:HH:mm}";
    }

    /// <summary>Accepts "599 12 34 56", "995599123456" or "+995599123456". Returns E.164 or null.</summary>
    public static string? NormalizePhone(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var digits = Regex.Replace(input, "[^0-9]", "");
        if (digits.Length == 9 && digits.StartsWith('5')) digits = "995" + digits;
        if (digits.Length < 11 || digits.Length > 15) return null;
        return "+" + digits;
    }

    /// <summary>+995599123421 → "5•• •• •4 21"</summary>
    public static string MaskPhone(string phone)
    {
        var local = phone.StartsWith("+995") ? phone[4..] : phone.TrimStart('+');
        if (local.Length < 4) return "•••";
        return $"{local[0]}•• •• •{local[^3]} {local[^2..]}";
    }

    public static int PercentOff(decimal regular, decimal group) =>
        regular <= 0 ? 0 : (int)Math.Round((regular - group) / regular * 100);

    public static decimal RoundTo5(decimal v) => Math.Round(v / 5, MidpointRounding.AwayFromZero) * 5;
}
