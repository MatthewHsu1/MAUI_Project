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
    /// <param name="now">The UTC instant the claim is made, compared against a pending retry.</param>
    /// <param name="ct">Cancels the claim.</param>
    /// <returns>
    /// True when this caller won the claim and must run the refresh; false when
    /// another caller already claimed <paramref name="today"/> and this caller
    /// must serve the cached data.
    /// </returns>
    /// <remarks>
    /// <para>
    /// A read-then-write gate lets concurrent requests all observe the stale
    /// marker and all start a whole-market refresh. This claim is one
    /// conditional statement, so only the first caller of the day wins.
    /// </para>
    /// <para>
    /// A caller also wins when the day is already claimed but a previous
    /// attempt released it and its
    /// <see cref="BondValuationRefreshState.RetryNotBefore"/> has passed. A
    /// won claim clears that marker, so the retry is handed to exactly one
    /// caller too.
    /// </para>
    /// </remarks>
    Task<bool> TryClaimAttemptAsync(DateOnly today, DateTime now, CancellationToken ct = default);

    /// <summary>
    /// Gives today's claim back after a failed attempt, so it can be retried
    /// once <paramref name="retryNotBefore"/> has passed.
    /// </summary>
    /// <param name="retryNotBefore">The earliest UTC instant another caller may claim the day again.</param>
    /// <param name="ct">Cancels the release.</param>
    /// <remarks>
    /// Without this, a single upstream failure consumes the whole trading day:
    /// the claim is stamped before the refresh runs, so every later read sees
    /// the day as done and serves an empty cache until tomorrow.
    /// </remarks>
    Task ReleaseClaimAsync(DateTime retryNotBefore, CancellationToken ct = default);
}
