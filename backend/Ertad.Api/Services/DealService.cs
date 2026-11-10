using System.Security.Cryptography;
using Ertad.Api.Data;
using Ertad.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Services;

public record NewDealInput(
    int StoreProductId, DealOrigin Origin, decimal GroupPrice, int MinReservations, int MaxStock,
    DateTime ReservationDeadline, int PickupDays, string? WarrantyTerms, bool Publish);

public record ReserveResult(Reservation? Reservation, string? Error);

public enum CodeCheckStatus { Valid, AlreadyRedeemed, Expired, Cancelled, NotFound }

public record CodeCheckResult(
    CodeCheckStatus Status, string? ProductName = null, decimal? Price = null,
    string? MaskedPhone = null, DateTime? ExpiresAt = null, DateTime? RedeemedAt = null);

/// <summary>All deal state changes live here. Counters only move through atomic UPDATEs.</summary>
public class DealService(AppDbContext db, Notifier notifier, IConfiguration config)
{
    private string PublicUrl => (config["App:PublicUrl"] ?? "http://localhost:5173").TrimEnd('/');
    private string DealLink(Deal d, string src = "sms") => $"{PublicUrl}/d/{d.PublicSlug}?src={src}";

    private static readonly DealStatus[] Live = [DealStatus.Open, DealStatus.Activated];

    // ---------------------------------------------------------------- create / publish

    public async Task<(Deal? Deal, string? Error)> CreateAsync(int storeId, NewDealInput input)
    {
        var product = await db.StoreProducts.FirstOrDefaultAsync(p => p.Id == input.StoreProductId && p.StoreId == storeId);
        if (product == null) return (null, "პროდუქტი ვერ მოიძებნა");
        if (input.GroupPrice <= 0) return (null, "ფასი უნდა იყოს 0-ზე მეტი");
        if (input.MinReservations < 1) return (null, "მინიმალური ჯავშანი უნდა იყოს მინიმუმ 1");
        if (input.MaxStock < input.MinReservations) return (null, "მარაგი არ უნდა იყოს მინიმალურ ჯგუფზე ნაკლები");
        if (input.PickupDays < 1) return (null, "გატანის ვადა მინიმუმ 1 დღე");
        if (input.ReservationDeadline.ToUniversalTime() <= DateTime.UtcNow.AddMinutes(5)) return (null, "ვადა მომავალში უნდა იყოს");

        var deal = new Deal
        {
            StoreProductId = product.Id,
            Origin = input.Origin,
            GroupPrice = input.GroupPrice,
            RegularPriceSnapshot = product.RegularPrice,
            MinReservations = input.MinReservations,
            MaxStock = input.MaxStock,
            ReservationDeadline = input.ReservationDeadline.ToUniversalTime(),
            PickupDays = input.PickupDays,
            WarrantyTerms = input.WarrantyTerms?.Trim() ?? "",
            Status = DealStatus.Draft,
            PublicSlug = NewSlug(),
        };
        db.Deals.Add(deal);
        await db.SaveChangesAsync();

        if (input.Publish)
        {
            var err = await PublishAsync(storeId, deal.Id);
            if (err != null) return (deal, err);
        }
        return (deal, null);
    }

    public async Task<string?> PublishAsync(int storeId, int dealId)
    {
        var deal = await db.Deals.AsNoTracking().Include(d => d.StoreProduct)
            .FirstOrDefaultAsync(d => d.Id == dealId && d.StoreProduct.StoreId == storeId);
        if (deal == null) return "შეთავაზება ვერ მოიძებნა";
        if (deal.Status != DealStatus.Draft) return "შეთავაზება უკვე გამოქვეყნებულია";
        if (deal.ReservationDeadline <= DateTime.UtcNow) return "ვადა უკვე გასულია";
        if (await db.Deals.AnyAsync(d => d.StoreProductId == deal.StoreProductId && Live.Contains(d.Status)))
            return "ამ პროდუქტზე უკვე არის აქტიური შეთავაზება";

        await using var tx = await db.Database.BeginTransactionAsync();
        var n = await db.Deals.Where(d => d.Id == dealId && d.Status == DealStatus.Draft)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, DealStatus.Open).SetProperty(d => d.PublishedAt, DateTime.UtcNow));
        if (n == 0) return "შეთავაზება უკვე გამოქვეყნებულია";

        var interested = await db.DiscountInterests
            .Where(i => i.StoreProductId == deal.StoreProductId && i.Status == InterestStatus.Active)
            .Select(i => i.UserId).ToListAsync();
        foreach (var userId in interested)
            notifier.Queue(userId, "DealPublished", deal.Id,
                $"ერთად: {deal.StoreProduct.Name} — ჯგუფური ფასი {Format.Money(deal.GroupPrice)} (ჩვეულებრივ {Format.Money(deal.RegularPriceSnapshot)}). " +
                $"საჭიროა {deal.MinReservations} ჯავშანი {Format.Date(deal.ReservationDeadline)}-მდე. {DealLink(deal)}");

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await notifier.FlushAsync();
        return null;
    }

    // ---------------------------------------------------------------- reserve

    public async Task<ReserveResult> ReserveAsync(int dealId, int userId, ReservationSource source, int? refUserId)
    {
        var existing = await FindActiveReservation(dealId, userId);
        if (existing != null) return new(existing, null);

        var now = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync();

        // Atomic slot grab. On success this row stays locked until commit, so concurrent
        // buyers are serialized and the counter can never pass MaxStock.
        var taken = await db.Deals
            .Where(d => d.Id == dealId && Live.Contains(d.Status) && d.ReservationDeadline > now && d.ConfirmedCount < d.MaxStock)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfirmedCount, d => d.ConfirmedCount + 1));

        var deal = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).FirstOrDefaultAsync(d => d.Id == dealId);
        if (deal == null) return new(null, "შეთავაზება ვერ მოიძებნა");
        if (taken == 0 && (!Live.Contains(deal.Status) || deal.ReservationDeadline <= now))
            return new(null, "შეთავაზება აღარ არის აქტიური");

        var reservation = new Reservation
        {
            DealId = dealId,
            UserId = userId,
            Status = taken == 1 ? ReservationStatus.Confirmed : ReservationStatus.Waitlisted,
            Source = source,
            RefUserId = refUserId == userId ? null : refUserId,
            CreatedAt = now,
        };
        db.Reservations.Add(reservation);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Unique index hit: the same user reserved in parallel. Roll back our slot.
            await tx.RollbackAsync();
            db.ChangeTracker.Clear();
            return new(await FindActiveReservation(dealId, userId), null);
        }

        if (taken == 1)
        {
            if (deal.Status == DealStatus.Activated)
                await IssueCodeAsync(reservation, deal, now, "GroupActivated");
            else if (deal.ConfirmedCount >= deal.MinReservations)
                await ActivateAsync(deal, now);
        }
        else
        {
            notifier.Queue(userId, "Waitlisted", dealId,
                $"ერთად: {deal.StoreProduct.Name} — მარაგი ამოიწურა, ჩაწერილი ხარ მოლოდინის სიაში. ადგილი თუ გათავისუფლდა, SMS-ით გაცნობებთ.");
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await notifier.FlushAsync();
        return new(reservation, null);
    }

    private Task<Reservation?> FindActiveReservation(int dealId, int userId) =>
        db.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.DealId == dealId && r.UserId == userId && r.Status != ReservationStatus.Cancelled);

    /// <summary>Called inside a transaction that holds the deal row lock.</summary>
    private async Task ActivateAsync(Deal deal, DateTime now)
    {
        var n = await db.Deals.Where(d => d.Id == deal.Id && d.Status == DealStatus.Open && d.ConfirmedCount >= d.MinReservations)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, DealStatus.Activated).SetProperty(d => d.ActivatedAt, now));
        if (n == 0) return;

        var confirmed = await db.Reservations
            .Where(r => r.DealId == deal.Id && r.Status == ReservationStatus.Confirmed && r.PickupCode == null)
            .ToListAsync();
        foreach (var r in confirmed)
            await IssueCodeAsync(r, deal, now, "GroupActivated");
    }

    private async Task IssueCodeAsync(Reservation r, Deal deal, DateTime now, string type)
    {
        var storeId = deal.StoreProduct.StoreId;
        string code;
        do code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        while (await db.PickupCodes.AnyAsync(c => c.StoreId == storeId && c.Code == code && c.RedeemedAt == null));

        var pc = new PickupCode
        {
            ReservationId = r.Id,
            StoreId = storeId,
            Code = code,
            IssuedAt = now,
            ExpiresAt = now.AddDays(deal.PickupDays),
        };
        db.PickupCodes.Add(pc);

        var text = type == "WaitlistPromoted"
            ? $"ერთად: გათავისუფლდა ადგილი! {deal.StoreProduct.Name} შენთვის {Format.Money(deal.GroupPrice)}-ად."
            : $"ერთად: ჯგუფი შეივსო! {deal.StoreProduct.Name} შენთვის {Format.Money(deal.GroupPrice)}-ად.";
        notifier.Queue(r.UserId, type, deal.Id,
            $"{text} გატანის კოდი: {code}. გაიტანე {Format.Date(pc.ExpiresAt)}-მდე. გადახდა მაღაზიაში.");
    }

    // ---------------------------------------------------------------- cancel / waitlist

    public async Task<string?> CancelReservationAsync(int reservationId, int userId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var r = await db.Reservations.FirstOrDefaultAsync(x => x.Id == reservationId && x.UserId == userId);
        if (r == null) return "ჯავშანი ვერ მოიძებნა";
        if (r.Status is not (ReservationStatus.Confirmed or ReservationStatus.Waitlisted)) return "ამ ჯავშნის გაუქმება აღარ შეიძლება";

        var wasConfirmed = r.Status == ReservationStatus.Confirmed;
        r.Status = ReservationStatus.Cancelled;
        await db.SaveChangesAsync();

        if (wasConfirmed)
            await FreeSlotAndPromoteAsync(r.DealId);

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await notifier.FlushAsync();
        return null;
    }

    /// <summary>A confirmed slot was cancelled or expired: decrement and offer it to the first waitlisted buyer.</summary>
    private async Task FreeSlotAndPromoteAsync(int dealId)
    {
        var now = DateTime.UtcNow;
        await db.Deals.Where(d => d.Id == dealId && d.ConfirmedCount > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfirmedCount, d => d.ConfirmedCount - 1));

        var deal = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).FirstAsync(d => d.Id == dealId);
        if (!Live.Contains(deal.Status)) return;
        if (deal.Status == DealStatus.Open && deal.ReservationDeadline <= now) return; // the job will fail it

        var next = await db.Reservations
            .Where(r => r.DealId == dealId && r.Status == ReservationStatus.Waitlisted)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .FirstOrDefaultAsync();
        if (next == null) return;

        var taken = await db.Deals.Where(d => d.Id == dealId && Live.Contains(d.Status) && d.ConfirmedCount < d.MaxStock)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfirmedCount, d => d.ConfirmedCount + 1));
        if (taken == 0) return;

        next.Status = ReservationStatus.Confirmed;
        await db.SaveChangesAsync();

        if (deal.Status == DealStatus.Activated)
        {
            await IssueCodeAsync(next, deal, now, "WaitlistPromoted");
        }
        else
        {
            notifier.Queue(next.UserId, "WaitlistPromoted", dealId,
                $"ერთად: გათავისუფლდა ადგილი — {deal.StoreProduct.Name} ჯგუფში ხარ. როცა ჯგუფი შეივსება, კოდს SMS-ით მიიღებ.");
            var fresh = await db.Deals.AsNoTracking().Include(d => d.StoreProduct).FirstAsync(d => d.Id == dealId);
            if (fresh.ConfirmedCount >= fresh.MinReservations) await ActivateAsync(fresh, now);
        }
    }

    // ---------------------------------------------------------------- redeem

    public async Task<CodeCheckResult> CheckCodeAsync(int storeId, string code)
    {
        code = code.Trim();
        var now = DateTime.UtcNow;
        var pc = await db.PickupCodes.AsNoTracking()
            .Include(c => c.Reservation).ThenInclude(r => r.User)
            .Include(c => c.Reservation).ThenInclude(r => r.Deal).ThenInclude(d => d.StoreProduct)
            .Where(c => c.StoreId == storeId && c.Code == code)
            .OrderBy(c => c.RedeemedAt == null ? 0 : 1).ThenByDescending(c => c.IssuedAt)
            .FirstOrDefaultAsync();
        if (pc == null) return new(CodeCheckStatus.NotFound);

        var r = pc.Reservation;
        var status = pc.RedeemedAt != null ? CodeCheckStatus.AlreadyRedeemed
            : r.Status == ReservationStatus.Cancelled ? CodeCheckStatus.Cancelled
            : r.Status == ReservationStatus.Expired || pc.ExpiresAt <= now ? CodeCheckStatus.Expired
            : CodeCheckStatus.Valid;
        return new(status, r.Deal.StoreProduct.Name, r.Deal.GroupPrice, Format.MaskPhone(r.User.Phone), pc.ExpiresAt, pc.RedeemedAt);
    }

    /// <summary>Idempotent: a code can be redeemed (and earn commission) exactly once.</summary>
    public async Task<CodeCheckResult> RedeemAsync(int storeId, string code, int staffId)
    {
        code = code.Trim();
        var now = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync();

        var target = await db.PickupCodes.AsNoTracking()
            .Where(c => c.StoreId == storeId && c.Code == code && c.RedeemedAt == null)
            .Select(c => new { c.Id, c.ReservationId })
            .FirstOrDefaultAsync();
        if (target == null) return await CheckCodeAsync(storeId, code);

        var n = await db.PickupCodes
            .Where(c => c.Id == target.Id && c.RedeemedAt == null && c.ExpiresAt > now && c.Reservation.Status == ReservationStatus.Confirmed)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.RedeemedAt, now).SetProperty(c => c.RedeemedByStaffId, staffId));
        if (n == 0)
        {
            await tx.RollbackAsync();
            return await CheckCodeAsync(storeId, code);
        }

        await db.Reservations.Where(r => r.Id == target.ReservationId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReservationStatus.Redeemed));

        var info = await db.Reservations.AsNoTracking()
            .Where(r => r.Id == target.ReservationId)
            .Select(r => new { r.UserId, r.DealId, r.Deal.StoreProduct.Name, r.Deal.StoreProduct.Store.CommissionPerItem })
            .FirstAsync();

        db.Commissions.Add(new Commission { PickupCodeId = target.Id, StoreId = storeId, Amount = info.CommissionPerItem, CreatedAt = now });
        notifier.Queue(info.UserId, "PickupCheck", info.DealId,
            $"ერთად: გაიტანე {info.Name}? უპასუხე 1 — დიახ, 2 — არა.");

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await notifier.FlushAsync();

        var result = await CheckCodeAsync(storeId, code);
        return result with { Status = CodeCheckStatus.Valid };
    }

    // ---------------------------------------------------------------- fail / jobs

    public async Task FailDealAsync(int dealId, string reasonText)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var n = await db.Deals.Where(d => d.Id == dealId && (d.Status == DealStatus.Open || d.Status == DealStatus.Activated || d.Status == DealStatus.Draft))
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, DealStatus.Failed));
        if (n == 0) return;

        var reservations = await db.Reservations
            .Where(r => r.DealId == dealId && (r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Waitlisted))
            .ToListAsync();
        var freed = reservations.Count(r => r.Status == ReservationStatus.Confirmed);
        foreach (var r in reservations)
        {
            r.Status = ReservationStatus.Cancelled;
            notifier.Queue(r.UserId, "DealFailed", dealId, reasonText);
        }
        if (freed > 0)
            await db.Deals.Where(d => d.Id == dealId)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.ConfirmedCount, d => d.ConfirmedCount - freed));
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await notifier.FlushAsync();
    }

    /// <summary>Runs every minute: deadlines, expiries, reminders, closing.</summary>
    public async Task RunJobsAsync()
    {
        var now = DateTime.UtcNow;

        // 1. Open deals past their deadline without enough reservations → Failed.
        var overdue = await db.Deals.AsNoTracking().Include(d => d.StoreProduct)
            .Where(d => d.Status == DealStatus.Open && d.ReservationDeadline <= now).ToListAsync();
        foreach (var d in overdue)
            await FailDealAsync(d.Id,
                $"ერთად: {d.StoreProduct.Name} — ჯგუფი ვერ შეივსო ვადაში. ჯავშანი გაუქმდა, არაფერი გადაგიხდია.");

        // 2. Unredeemed codes past pickup deadline → reservation Expired, slot goes to the waitlist.
        var expired = await db.PickupCodes.AsNoTracking()
            .Where(c => c.RedeemedAt == null && c.ExpiresAt <= now && c.Reservation.Status == ReservationStatus.Confirmed)
            .Select(c => new { c.ReservationId, c.Reservation.DealId }).ToListAsync();
        foreach (var e in expired)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var n = await db.Reservations.Where(r => r.Id == e.ReservationId && r.Status == ReservationStatus.Confirmed)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReservationStatus.Expired));
            if (n == 1) await FreeSlotAndPromoteAsync(e.DealId);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            await notifier.FlushAsync();
        }

        // 3. 24h-before-deadline reminder to people who reserved.
        var soon = await db.Deals.AsNoTracking().Include(d => d.StoreProduct)
            .Where(d => d.Status == DealStatus.Open && d.ReminderSentAt == null && d.ReservationDeadline > now && d.ReservationDeadline <= now.AddHours(24))
            .ToListAsync();
        foreach (var d in soon)
        {
            var claimed = await db.Deals.Where(x => x.Id == d.Id && x.ReminderSentAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReminderSentAt, now));
            if (claimed == 0) continue;
            var need = Math.Max(0, d.MinReservations - d.ConfirmedCount);
            var users = await db.Reservations.Where(r => r.DealId == d.Id && r.Status == ReservationStatus.Confirmed).Select(r => r.UserId).ToListAsync();
            foreach (var u in users)
                notifier.Queue(u, "Reminder", d.Id,
                    $"ერთად: {d.StoreProduct.Name} — კიდევ {need} სჭირდება, ვადა {Format.Date(d.ReservationDeadline)}. გაუზიარე: {PublicUrl}/d/{d.PublicSlug}?ref={u}");
            await db.SaveChangesAsync();
            await notifier.FlushAsync();
        }

        // 4. Activated deals past the deadline with nobody left to pick up → Closed.
        var finished = await db.Deals
            .Where(d => d.Status == DealStatus.Activated && d.ReservationDeadline <= now
                        && !db.Reservations.Any(r => r.DealId == d.Id && r.Status == ReservationStatus.Confirmed))
            .Select(d => d.Id).ToListAsync();
        foreach (var id in finished)
        {
            await db.Deals.Where(d => d.Id == id && d.Status == DealStatus.Activated)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.Status, DealStatus.Closed));
            await db.Reservations.Where(r => r.DealId == id && r.Status == ReservationStatus.Waitlisted)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, ReservationStatus.Cancelled));
        }
    }

    private static string NewSlug()
    {
        const string alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
        return string.Create(8, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        });
    }
}
