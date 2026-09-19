using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Bonds;

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
    /// Claims the next refresh attempt for exactly one caller.
    /// </summary>
    /// <param name="claim">Everything the claim predicate compares the marker against.</param>
    /// <param name="ct">Cancels the claim.</param>
    /// <returns>
    /// True when this caller won the claim and must run the refresh; false when
    /// the cached data is already current, when the day has been shown to be a
    /// non-trading day, or when another caller's attempt still holds the marker.
    /// </returns>
    Task<bool> TryClaimAttemptAsync(BondValuationRefreshClaim claim, CancellationToken ct = default);

    /// <summary>
    /// Records the earliest UTC instant at which the next refresh attempt may be
    /// claimed.
    /// </summary>
    /// <param name="notBefore">The earliest UTC instant another caller may claim an attempt.</param>
    /// <param name="ct">Cancels the write.</param>
    Task SetNextAttemptAsync(DateTime notBefore, CancellationToken ct = default);
}
