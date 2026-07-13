using AppName.Application.Dtos;

namespace AppName.Maui.Services;

/// <summary>
/// HTTP access to the bond-valuation endpoints exposed by AppName.Api. This
/// is the MAUI head's only source of bond data - the app no longer reads a
/// local database directly.
/// </summary>
public interface IBondsApiClient
{
    /// <summary>
    /// Fetches today's conversion valuation for every cached convertible
    /// bond from <c>GET /api/valuations</c>.
    /// </summary>
    Task<IReadOnlyList<ConversionValuationDto>> GetValuationsAsync(CancellationToken ct = default);
}
