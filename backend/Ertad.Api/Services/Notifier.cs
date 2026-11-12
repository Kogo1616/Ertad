using Ertad.Api.Data;
using Ertad.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Services;

public interface ISmsSender
{
    /// <param name="otp">True for login codes: providers that support it deliver these with top priority.</param>
    Task SendAsync(string phone, string body, bool otp = false);
}

/// <summary>Dev SMS: writes to the console. Every message is also stored in NotificationLog.</summary>
public class DevSmsSender(ILogger<DevSmsSender> log) : ISmsSender
{
    public Task SendAsync(string phone, string body, bool otp = false)
    {
        log.LogWarning("SMS to {Phone}: {Body}", phone, body);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Queues notifications inside the current DbContext (so they commit together with the
/// business change) and sends the SMS after the transaction commits.
/// </summary>
public class Notifier(AppDbContext db, ISmsSender sms, ILogger<Notifier> log)
{
    private readonly List<(int UserId, string Body)> _pending = [];

    public void Queue(int userId, string type, int? dealId, string body)
    {
        db.NotificationLogs.Add(new NotificationLog { UserId = userId, Type = type, DealId = dealId, Body = body });
        _pending.Add((userId, body));
    }

    public async Task FlushAsync()
    {
        if (_pending.Count == 0) return;
        var ids = _pending.Select(p => p.UserId).Distinct().ToList();
        var phones = await db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Phone);
        foreach (var (userId, body) in _pending)
        {
            if (!phones.TryGetValue(userId, out var phone)) continue;
            // The business change is already committed: a failed SMS is logged, never rolled back.
            try { await sms.SendAsync(phone, body); }
            catch (Exception ex) { log.LogError(ex, "SMS to user {UserId} failed", userId); }
        }
        _pending.Clear();
    }
}
