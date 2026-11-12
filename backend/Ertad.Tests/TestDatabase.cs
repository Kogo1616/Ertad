using Ertad.Api.Data;
using Ertad.Api.Domain;
using Ertad.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Ertad.Tests;

/// <summary>
/// Real PostgreSQL for tests. Uses ERTAD_TEST_DB (a server connection string) if set,
/// otherwise starts a throwaway container with Testcontainers (needs Docker).
/// Every test gets its own fresh, migrated database.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;
    private string _server = "";

    public async Task InitializeAsync()
    {
        var env = Environment.GetEnvironmentVariable("ERTAD_TEST_DB");
        if (!string.IsNullOrWhiteSpace(env))
        {
            _server = env;
            return;
        }
        _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await _container.StartAsync();
        _server = _container.GetConnectionString();
    }

    private readonly List<string> _created = [];

    public async Task DisposeAsync()
    {
        if (_container != null)
        {
            await _container.DisposeAsync();
            return;
        }
        // Using a shared local server: drop the databases this run created.
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_server) { Database = "postgres" }.ConnectionString);
        await conn.OpenAsync();
        foreach (var name in _created)
            await new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", conn).ExecuteNonQueryAsync();
    }

    public async Task<string> CreateDatabaseAsync()
    {
        var name = "ertad_test_" + Guid.NewGuid().ToString("N")[..12];
        lock (_created) _created.Add(name);
        var cs = new NpgsqlConnectionStringBuilder(_server) { Database = name }.ConnectionString;
        await using var db = NewContext(cs);
        await db.Database.MigrateAsync();
        return cs;
    }

    public static AppDbContext NewContext(string cs) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options);
}

[CollectionDefinition("db")]
public class DbCollection : ICollectionFixture<PostgresFixture>;

public class NullSms : ISmsSender
{
    public Task SendAsync(string phone, string body, bool otp = false) => Task.CompletedTask;
}

/// <summary>Builders for test data.</summary>
public static class TestData
{
    public static DealService Service(AppDbContext db) =>
        new(db, new Notifier(db, new NullSms(), NullLogger<Notifier>.Instance), new ConfigurationBuilder().Build());

    public record World(int StoreId, int ProductId, int DealId, List<int> UserIds);

    public static async Task<World> CreateAsync(string cs, int users, int min, int maxStock, DateTime? deadline = null)
    {
        await using var db = PostgresFixture.NewContext(cs);
        var store = new Store { Name = "Test", City = "ქუთაისი", Address = "a", MapUrl = "m", CommissionPerItem = 5 };
        var product = new StoreProduct { Store = store, Name = "ბლენდერი", RegularPrice = 80 };
        var userList = Enumerable.Range(1, users).Select(i => new User { Phone = $"+99559900{i:D4}", PhoneVerifiedAt = DateTime.UtcNow, DisplayInitial = "ა" }).ToList();
        var deal = new Deal
        {
            StoreProduct = product, Origin = DealOrigin.FromRequests, GroupPrice = 60, RegularPriceSnapshot = 80,
            MinReservations = min, MaxStock = maxStock, ReservationDeadline = deadline ?? DateTime.UtcNow.AddDays(2),
            PickupDays = 3, Status = DealStatus.Open, PublishedAt = DateTime.UtcNow, PublicSlug = "t" + Guid.NewGuid().ToString("N")[..8],
        };
        db.AddRange(store, product, deal);
        db.Users.AddRange(userList);
        await db.SaveChangesAsync();
        return new(store.Id, product.Id, deal.Id, userList.Select(u => u.Id).ToList());
    }

    public static async Task<Reservation> ReserveAsync(string cs, int dealId, int userId)
    {
        await using var db = PostgresFixture.NewContext(cs);
        var r = await Service(db).ReserveAsync(dealId, userId, ReservationSource.StorePage, null);
        Assert.Null(r.Error);
        return r.Reservation!;
    }
}
