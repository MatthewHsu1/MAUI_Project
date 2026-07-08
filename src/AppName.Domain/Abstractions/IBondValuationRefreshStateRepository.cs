using AppName.Domain.Entities;

namespace AppName.Domain.Abstractions;

/// <summary>
/// Local persistence of the single bond-data refresh marker.
/// </summary>
public interface IBondValuationRefreshStateRepository
{
    /// <summary>
    /// Returns the refresh marker, or a default (both dates null) when never set.
    /// </summary>
    Task<BondValuationRefreshState> GetAsync(CancellationToken ct = default);

    /// <summary>
    /// Inserts or updates the single refresh-marker row.
    /// </summary>
    Task SetAsync(BondValuationRefreshState state, CancellationToken ct = default);
}
