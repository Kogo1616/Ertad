using Ertad.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<StoreProduct> StoreProducts => Set<StoreProduct>();
    public DbSet<DiscountInterest> DiscountInterests => Set<DiscountInterest>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<PickupCode> PickupCodes => Set<PickupCode>();
    public DbSet<Commission> Commissions => Set<Commission>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        // Enums are stored as readable text ("Open", "Confirmed", ...).
        b.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
        b.Properties<decimal>().HavePrecision(10, 2);
    }

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<User>().HasIndex(x => x.Phone).IsUnique();
        m.Entity<StaffUser>().HasIndex(x => x.Email).IsUnique();
        m.Entity<OtpCode>().HasIndex(x => x.Phone);

        // One active interest per user per product.
        m.Entity<DiscountInterest>()
            .HasIndex(x => new { x.UserId, x.StoreProductId })
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'");

        m.Entity<Deal>().HasIndex(x => x.PublicSlug).IsUnique();
        m.Entity<Deal>().Property(x => x.Version).IsRowVersion();

        // One non-cancelled reservation per user per deal.
        m.Entity<Reservation>()
            .HasIndex(x => new { x.DealId, x.UserId })
            .IsUnique()
            .HasFilter("\"Status\" <> 'Cancelled'");

        m.Entity<PickupCode>().HasIndex(x => x.ReservationId).IsUnique();
        // Code is unique among the store's unredeemed codes.
        m.Entity<PickupCode>()
            .HasIndex(x => new { x.StoreId, x.Code })
            .IsUnique()
            .HasFilter("\"RedeemedAt\" IS NULL");

        // A code can produce at most one commission (idempotent redemption).
        m.Entity<Commission>().HasIndex(x => x.PickupCodeId).IsUnique();

        m.Entity<NotificationLog>().HasIndex(x => x.DealId);
    }
}
