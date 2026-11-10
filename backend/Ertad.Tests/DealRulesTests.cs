using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Tests;

[Collection("db")]
public class DealRulesTests(PostgresFixture pg)
{
    [Fact]
    public async Task Last_slot_race_exactly_one_buyer_wins()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 2, min: 5, maxStock: 1);

        // Two buyers hit "join" for the last slot at the same time, each on its own connection.
        var results = await Task.WhenAll(w.UserIds.Select(u => Task.Run(() => TestData.ReserveAsync(cs, w.DealId, u))));

        Assert.Single(results, r => r.Status == ReservationStatus.Confirmed);
        Assert.Single(results, r => r.Status == ReservationStatus.Waitlisted);
        await using var db = PostgresFixture.NewContext(cs);
        Assert.Equal(1, (await db.Deals.FindAsync(w.DealId))!.ConfirmedCount);
    }

    [Fact]
    public async Task Many_parallel_buyers_never_exceed_stock()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 12, min: 20, maxStock: 5);

        var results = await Task.WhenAll(w.UserIds.Select(u => Task.Run(() => TestData.ReserveAsync(cs, w.DealId, u))));

        Assert.Equal(5, results.Count(r => r.Status == ReservationStatus.Confirmed));
        Assert.Equal(7, results.Count(r => r.Status == ReservationStatus.Waitlisted));
        await using var db = PostgresFixture.NewContext(cs);
        Assert.Equal(5, (await db.Deals.FindAsync(w.DealId))!.ConfirmedCount);
        Assert.Equal(5, await db.Reservations.CountAsync(r => r.DealId == w.DealId && r.Status == ReservationStatus.Confirmed));
    }

    [Fact]
    public async Task Same_buyer_twice_gets_one_reservation()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 1, min: 5, maxStock: 5);

        await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Task.Run(() => TestData.ReserveAsync(cs, w.DealId, w.UserIds[0]))));

        await using var db = PostgresFixture.NewContext(cs);
        Assert.Equal(1, await db.Reservations.CountAsync(r => r.DealId == w.DealId));
        Assert.Equal(1, (await db.Deals.FindAsync(w.DealId))!.ConfirmedCount);
    }

    [Fact]
    public async Task Deal_activates_when_minimum_is_reached_and_codes_are_issued()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 3, min: 3, maxStock: 10);

        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[0]);
        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[1]);
        await using (var db = PostgresFixture.NewContext(cs))
        {
            Assert.Equal(DealStatus.Open, (await db.Deals.FindAsync(w.DealId))!.Status);
            Assert.Equal(0, await db.PickupCodes.CountAsync());
        }

        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[2]);

        await using (var db = PostgresFixture.NewContext(cs))
        {
            var deal = (await db.Deals.FindAsync(w.DealId))!;
            Assert.Equal(DealStatus.Activated, deal.Status);
            Assert.NotNull(deal.ActivatedAt);
            var codes = await db.PickupCodes.ToListAsync();
            Assert.Equal(3, codes.Count);
            Assert.All(codes, c => Assert.Matches("^[0-9]{6}$", c.Code));
            Assert.Equal(3, codes.Select(c => c.Code).Distinct().Count());
            Assert.All(codes, c => Assert.Equal(deal.ActivatedAt!.Value.AddDays(3), c.ExpiresAt, TimeSpan.FromSeconds(1)));
            Assert.Equal(3, await db.NotificationLogs.CountAsync(n => n.Type == "GroupActivated"));
        }
    }

    [Fact]
    public async Task Redemption_is_idempotent_one_sale_one_commission()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 1, min: 1, maxStock: 5);
        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[0]);

        string code;
        await using (var db = PostgresFixture.NewContext(cs))
            code = (await db.PickupCodes.SingleAsync()).Code;

        // Staff double-clicks / two tills enter the same code at once.
        var results = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => Task.Run(async () =>
        {
            await using var db = PostgresFixture.NewContext(cs);
            return await TestData.Service(db).RedeemAsync(w.StoreId, code, staffId: 0);
        })));

        Assert.Single(results, r => r.Status == CodeCheckStatus.Valid);
        Assert.Equal(2, results.Count(r => r.Status == CodeCheckStatus.AlreadyRedeemed));

        await using (var db = PostgresFixture.NewContext(cs))
        {
            Assert.Equal(1, await db.Commissions.CountAsync());
            Assert.Equal(5m, (await db.Commissions.SingleAsync()).Amount);
            Assert.Equal(ReservationStatus.Redeemed, (await db.Reservations.SingleAsync()).Status);
            var again = await TestData.Service(db).RedeemAsync(w.StoreId, code, 0);
            Assert.Equal(CodeCheckStatus.AlreadyRedeemed, again.Status);
            Assert.Equal(1, await db.Commissions.CountAsync());
        }
    }

    [Fact]
    public async Task Deadline_job_fails_deal_below_minimum_and_cancels_reservations()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 2, min: 5, maxStock: 10);
        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[0]);
        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[1]);

        await using var db = PostgresFixture.NewContext(cs);
        await db.Deals.Where(d => d.Id == w.DealId)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.ReservationDeadline, DateTime.UtcNow.AddMinutes(-1)));

        await TestData.Service(db).RunJobsAsync();

        db.ChangeTracker.Clear();
        var deal = (await db.Deals.FindAsync(w.DealId))!;
        Assert.Equal(DealStatus.Failed, deal.Status);
        Assert.Equal(0, deal.ConfirmedCount);
        Assert.All(await db.Reservations.ToListAsync(), r => Assert.Equal(ReservationStatus.Cancelled, r.Status));
        Assert.Equal(2, await db.NotificationLogs.CountAsync(n => n.Type == "DealFailed"));
        Assert.Equal(0, await db.PickupCodes.CountAsync());
    }

    [Fact]
    public async Task Cancelled_slot_goes_to_first_waitlisted_buyer_with_a_code()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 3, min: 1, maxStock: 1);
        var first = await TestData.ReserveAsync(cs, w.DealId, w.UserIds[0]);   // confirmed + activated
        var second = await TestData.ReserveAsync(cs, w.DealId, w.UserIds[1]);  // waitlisted #1
        await TestData.ReserveAsync(cs, w.DealId, w.UserIds[2]);               // waitlisted #2
        Assert.Equal(ReservationStatus.Waitlisted, second.Status);

        await using var db = PostgresFixture.NewContext(cs);
        Assert.Null(await TestData.Service(db).CancelReservationAsync(first.Id, w.UserIds[0]));

        db.ChangeTracker.Clear();
        var promoted = await db.Reservations.Include(r => r.PickupCode).SingleAsync(r => r.Id == second.Id);
        Assert.Equal(ReservationStatus.Confirmed, promoted.Status);
        Assert.NotNull(promoted.PickupCode);
        Assert.Equal(1, (await db.Deals.FindAsync(w.DealId))!.ConfirmedCount);
        Assert.Equal(1, await db.NotificationLogs.CountAsync(n => n.Type == "WaitlistPromoted"));
    }

    [Fact]
    public async Task Only_one_active_interest_per_user_per_product()
    {
        var cs = await pg.CreateDatabaseAsync();
        var w = await TestData.CreateAsync(cs, users: 1, min: 1, maxStock: 1);
        await using var db = PostgresFixture.NewContext(cs);

        db.DiscountInterests.Add(new DiscountInterest { UserId = w.UserIds[0], StoreProductId = w.ProductId, MaxPrice = 60 });
        await db.SaveChangesAsync();

        db.DiscountInterests.Add(new DiscountInterest { UserId = w.UserIds[0], StoreProductId = w.ProductId, MaxPrice = 55 });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());

        // After withdrawing, a new active interest is allowed again.
        db.ChangeTracker.Clear();
        await db.DiscountInterests.ExecuteUpdateAsync(s => s.SetProperty(i => i.Status, InterestStatus.Withdrawn));
        db.DiscountInterests.Add(new DiscountInterest { UserId = w.UserIds[0], StoreProductId = w.ProductId, MaxPrice = 55 });
        await db.SaveChangesAsync();
        Assert.Equal(1, await db.DiscountInterests.CountAsync(i => i.Status == InterestStatus.Active));
    }
}
