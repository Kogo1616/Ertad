using Ertad.Api.Domain;
using Ertad.Api.Services;

namespace Ertad.Api.Controllers;

/// <summary>Shapes returned to the public site. Never put anyone's MaxPrice in here.</summary>
public static class Dto
{
    public static object DealCard(Deal d) => new
    {
        d.Id,
        slug = d.PublicSlug,
        d.Origin,
        d.Status,
        productId = d.StoreProductId,
        productName = d.StoreProduct.Name,
        imageUrl = d.StoreProduct.ImageUrl,
        storeId = d.StoreProduct.StoreId,
        storeName = d.StoreProduct.Store.Name,
        storeCity = d.StoreProduct.Store.City,
        d.GroupPrice,
        regularPrice = d.RegularPriceSnapshot,
        percentOff = Format.PercentOff(d.RegularPriceSnapshot, d.GroupPrice),
        confirmed = d.ConfirmedCount,
        min = d.MinReservations,
        d.MaxStock,
        deadline = d.ReservationDeadline,
        d.PickupDays,
        d.WarrantyTerms,
        d.ActivatedAt,
    };
}
