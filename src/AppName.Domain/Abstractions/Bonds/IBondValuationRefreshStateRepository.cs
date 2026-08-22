using AppName.Domain.Entities.Bonds;

namespace AppName.Domain.Abstractions.Bonds;

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

    /// <summary>
    /// Claims today's refresh attempt for exactly one caller.
    /// </summary>
    /// <param name="today">The Taiwan calendar date of the attempt.</param>
    /// <param name="ct">Cancels the claim.</param>
    /// <returns>
    /// True when this caller won the claim and must run the refresh; false when
    /// another caller already claimed <paramref name="today"/> and this caller
    /// must serve the cached data.
    /// </returns>
    /// <remarks>
    /// A read-then-write gate lets concurrent requests all observe the stale
    /// marker and all start a whole-market refresh. This claim is one
    /// conditional statement, so only the first caller of the day wins.
    /// </remarks>
    Task<bool> TryClaimAttemptAsync(DateOnly today, CancellationToken ct = default);
}
