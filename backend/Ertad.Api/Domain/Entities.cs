namespace Ertad.Api.Domain;

public enum InterestStatus { Active, Withdrawn }
public enum DealOrigin { StoreInitiated, FromRequests }
public enum DealStatus { Draft, Open, Activated, Failed, Closed }
public enum ReservationStatus { Confirmed, Waitlisted, Cancelled, Expired, Redeemed }
public enum ReservationSource { StorePage, DealsList, SharedLink, Notification }
public enum StaffRole { StoreStaff, Admin }

/// <summary>Buyer. Identified only by a verified phone number.</summary>
public class User
{
    public int Id { get; set; }
    public string Phone { get; set; } = "";          // E.164, e.g. +995599123456
    public DateTime? PhoneVerifiedAt { get; set; }
    public string DisplayInitial { get; set; } = "?";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class OtpCode
{
    public int Id { get; set; }
    public string Phone { get; set; } = "";
    public string Code { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTime? UsedAt { get; set; }
}

/// <summary>Store staff or platform admin (email + password).</summary>
public class StaffUser
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public StaffRole Role { get; set; }
    public int? StoreId { get; set; }
    public Store? Store { get; set; }
}

public class Store
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public string Address { get; set; } = "";
    public string MapUrl { get; set; } = "";
    public string? ImageUrl { get; set; }
    /// <summary>Short "about the store" text shown on the store list and store page.</summary>
    public string Description { get; set; } = "";
    public string Phone { get; set; } = "";
    /// <summary>Free text, e.g. "ორშ–შაბ 10:00–20:00".</summary>
    public string WorkingHours { get; set; } = "";
    public decimal CommissionPerItem { get; set; } = 5;
    public bool IsActive { get; set; } = true;
    public List<StoreProduct> Products { get; set; } = [];
}

public class StoreProduct
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public Store Store { get; set; } = null!;
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ImageUrl { get; set; }
    public decimal RegularPrice { get; set; }
    public bool IsActive { get; set; } = true;
}

public class DiscountInterest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int StoreProductId { get; set; }
    public StoreProduct StoreProduct { get; set; } = null!;
    public decimal? MaxPrice { get; set; }
    public InterestStatus Status { get; set; } = InterestStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Deal
{
    public int Id { get; set; }
    public int StoreProductId { get; set; }
    public StoreProduct StoreProduct { get; set; } = null!;
    public DealOrigin Origin { get; set; }
    public decimal GroupPrice { get; set; }
    public decimal RegularPriceSnapshot { get; set; }
    public int MinReservations { get; set; }
    public int MaxStock { get; set; }
    public DateTime ReservationDeadline { get; set; }
    public int PickupDays { get; set; }
    public string WarrantyTerms { get; set; } = "";
    public DealStatus Status { get; set; } = DealStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? ReminderSentAt { get; set; }
    /// <summary>Confirmed + Redeemed reservations. Only changed with atomic UPDATEs.</summary>
    public int ConfirmedCount { get; set; }
    public uint Version { get; set; }                 // Postgres xmin
    public string PublicSlug { get; set; } = "";
}

public class Reservation
{
    public int Id { get; set; }
    public int DealId { get; set; }
    public Deal Deal { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public ReservationStatus Status { get; set; }
    public ReservationSource Source { get; set; }
    public int? RefUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public PickupCode? PickupCode { get; set; }
}

public class PickupCode
{
    public int Id { get; set; }
    public int ReservationId { get; set; }
    public Reservation Reservation { get; set; } = null!;
    public int StoreId { get; set; }
    public string Code { get; set; } = "";
    public DateTime IssuedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RedeemedAt { get; set; }
    public int? RedeemedByStaffId { get; set; }
    /// <summary>Buyer's answer to "did you pick up the item?" (1 = yes, 2 = no).</summary>
    public bool? BuyerConfirmedPickup { get; set; }
}

public class Commission
{
    public int Id { get; set; }
    public int PickupCodeId { get; set; }
    public PickupCode PickupCode { get; set; } = null!;
    public int StoreId { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A store that wants to join, sent from the public "for stores" page.</summary>
public class PartnerLead
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string StoreName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string City { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Handled { get; set; }
}

public class NotificationLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = "";
    public int? DealId { get; set; }
    public string Body { get; set; } = "";
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
