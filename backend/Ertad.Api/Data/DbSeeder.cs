using Ertad.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Ertad.Api.Data;

/// <summary>Demo data for the Kutaisi pilot. Runs only when the database is empty.</summary>
public static class DbSeeder
{
    public const string StoreEmail = "store@ertad.ge";
    public const string StorePassword = "Store123!";
    public const string AdminEmail = "admin@ertad.ge";
    public const string AdminPassword = "Admin123!";

    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Stores.AnyAsync()) return;
        var now = DateTime.UtcNow;

        var store = new Store
        {
            Name = "[მაღაზია]", City = "ქუთაისი", Address = "[მისამართი], ქუთაისი",
            MapUrl = "https://maps.google.com/?q=Kutaisi", CommissionPerItem = 5,
        };
        (string Name, string Desc, decimal Price)[] items =
        [
            ("ბლენდერი 600W", "1.5 ლ · 2 სიჩქარე · [მოდელი]", 80),
            ("ელ. ჩაიდანი 1.7 ლ", "უჟანგავი ფოლადი · 2200W", 65),
            ("ორთქლის უთო", "2400W · კერამიკული ძირი", 120),
            ("თმის ფენი 2000W", "3 ტემპერატურა · იონიზაცია", 90),
            ("ტოსტერი", "2 ნაჭერი · 7 რეჟიმი", 70),
            ("ხელის მიქსერი", "5 სიჩქარე · 300W", 55),
            ("ყავის აპარატი", "ესპრესო · 15 ბარი · რძის ქაფი", 260),
            ("მტვერსასრუტი", "2000W · HEPA ფილტრი", 220),
            ("მიკროტალღური ღუმელი", "20 ლ · 700W", 240),
            ("მულტისახარში", "5 ლ · 12 პროგრამა", 180),
            ("წვენსაწური", "800W · 2 სიჩქარე", 110),
            ("ელ. გამათბობელი", "2000W · თერმოსტატი", 95),
        ];
        foreach (var (name, desc, price) in items)
            store.Products.Add(new StoreProduct { Name = name, Description = desc, RegularPrice = price });
        db.Stores.Add(store);

        var hasher = new PasswordHasher<StaffUser>();
        var staff = new StaffUser { Email = StoreEmail, Role = StaffRole.StoreStaff, Store = store };
        staff.PasswordHash = hasher.HashPassword(staff, StorePassword);
        var admin = new StaffUser { Email = AdminEmail, Role = StaffRole.Admin };
        admin.PasswordHash = hasher.HashPassword(admin, AdminPassword);
        db.StaffUsers.AddRange(staff, admin);

        // 30 demo buyers: +995 555 00 00 01 … 30
        var initials = "ნლგთმსაბდევზიკოპრტუფქღყშჩცძწჭხჯ";
        var users = Enumerable.Range(1, 30).Select(i => new User
        {
            Phone = $"+99555500{i:D4}",
            PhoneVerifiedAt = now,
            DisplayInitial = initials[(i - 1) % initials.Length].ToString(),
            CreatedAt = now.AddDays(-10),
        }).ToList();
        db.Users.AddRange(users);
        await db.SaveChangesAsync();

        var p = store.Products;
        StoreProduct blender = p[0], kettle = p[1], iron = p[2], dryer = p[3], toaster = p[4], coffee = p[6];

        // Blender: 18 interested, 12 with a price (3×≤50, 2×55, 7×60), 6 without.
        decimal?[] blenderPrices = [45, 50, 50, 55, 55, 60, 60, 60, 60, 60, 60, 60, null, null, null, null, null, null];
        for (var i = 0; i < blenderPrices.Length; i++)
            db.DiscountInterests.Add(new DiscountInterest { UserId = users[i].Id, StoreProductId = blender.Id, MaxPrice = blenderPrices[i], CreatedAt = now.AddDays(-5 + i * 0.1) });

        void AddInterests(StoreProduct product, int count, int offset, params decimal?[] prices)
        {
            for (var i = 0; i < count; i++)
                db.DiscountInterests.Add(new DiscountInterest
                {
                    UserId = users[(offset + i) % users.Count].Id,
                    StoreProductId = product.Id,
                    MaxPrice = i < prices.Length ? prices[i] : null,
                    CreatedAt = now.AddDays(-3),
                });
        }
        AddInterests(kettle, 9, 18, 50, 50, 50, 55, 45);
        AddInterests(iron, 6, 5, 95, 95, 90, 100);
        AddInterests(dryer, 4, 10, 70, 70);
        AddInterests(toaster, 2, 25, 55);

        // Deal 1: from requests — blender 60 ₾, 7 / 10, stock 20.
        var blenderDeal = new Deal
        {
            StoreProductId = blender.Id, Origin = DealOrigin.FromRequests, GroupPrice = 60, RegularPriceSnapshot = 80,
            MinReservations = 10, MaxStock = 20, ReservationDeadline = now.AddDays(1).AddHours(6), PickupDays = 3,
            WarrantyTerms = "1 წლიანი გარანტია", Status = DealStatus.Open, PublishedAt = now.AddDays(-1),
            ConfirmedCount = 7, PublicSlug = "blender-60",
        };
        // Deal 2: store initiative — coffee machine 210 ₾, min 6, stock 12, 2 reserved.
        var coffeeDeal = new Deal
        {
            StoreProductId = coffee.Id, Origin = DealOrigin.StoreInitiated, GroupPrice = 210, RegularPriceSnapshot = 260,
            MinReservations = 6, MaxStock = 12, ReservationDeadline = now.AddDays(4), PickupDays = 3,
            WarrantyTerms = "2 წლიანი გარანტია", Status = DealStatus.Open, PublishedAt = now.AddHours(-6),
            ConfirmedCount = 2, PublicSlug = "coffee-210",
        };
        db.Deals.AddRange(blenderDeal, coffeeDeal);
        await db.SaveChangesAsync();

        ReservationSource[] sources = [ReservationSource.StorePage, ReservationSource.SharedLink, ReservationSource.Notification, ReservationSource.StorePage, ReservationSource.SharedLink, ReservationSource.DealsList, ReservationSource.Notification];
        for (var i = 0; i < 7; i++)
            db.Reservations.Add(new Reservation
            {
                DealId = blenderDeal.Id, UserId = users[5 + i].Id, Status = ReservationStatus.Confirmed,
                Source = sources[i], RefUserId = sources[i] == ReservationSource.SharedLink ? users[5].Id : null,
                CreatedAt = now.AddHours(-20 + i * 2),
            });
        for (var i = 0; i < 2; i++)
            db.Reservations.Add(new Reservation
            {
                DealId = coffeeDeal.Id, UserId = users[20 + i].Id, Status = ReservationStatus.Confirmed,
                Source = ReservationSource.DealsList, CreatedAt = now.AddHours(-3 + i),
            });
        await db.SaveChangesAsync();
    }
}
