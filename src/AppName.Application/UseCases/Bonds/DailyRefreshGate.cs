using AppName.Application.Time;
using AppName.Domain.Abstractions.Bonds;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// The once-per-Taiwan-trading-day refresh gate every valuation read passes
/// through.
/// </summary>
/// <remarks>
/// <para>
/// The gate is a static internal collaborator rather than a private helper on
/// each use case, because three use cases share it and three copies drift. It
/// stays static and takes its dependencies as arguments so it needs no DI
/// registration, and so the use-case tests reach it through the use cases they
/// already build instead of through <c>InternalsVisibleTo</c>.
/// </para>
/// <para>
/// The gate claims the day instead of reading the marker and comparing it. The
/// grid starts the count query and the first window query together on mount, and
/// neither is guaranteed to arrive first. A read followed by a separate write
/// lets both callers see the stale marker, so both start a whole-market refresh.
/// <see cref="IBondValuationRefreshStateRepository.TryClaimAttemptAsync"/> tests
/// and sets in one statement, so exactly one caller wins the day.
/// </para>
/// </remarks>
internal static class DailyRefreshGate
{
    /// <summary>
    /// Refreshes the valuation cache when this caller wins today's claim, and
    /// returns without refreshing when it loses.
    /// </summary>
    /// <param name="refreshStateRepo">Holds the singleton refresh marker the claim updates.</param>
    /// <param name="refreshAllBonds">Runs the whole-market refresh.</param>
    /// <param name="timeProvider">Resolves today's Taiwan trading date.</param>
    /// <param name="ct">Cancels the claim and the refresh.</param>
    internal static async Task EnsureFreshAsync(
        IBondValuationRefreshStateRepository refreshStateRepo,
        IRefreshAllBondsUseCase refreshAllBonds,
        TimeProvider timeProvider,
        CancellationToken ct)
    {
        var today = TaiwanClock.Today(timeProvider);

        // A losing claim falls through and serves the cache. It does not wait for
        // the winner, because freshness is best-effort and waiting would couple
        // every window request to one whole-market fetch.
        if (await refreshStateRepo.TryClaimAttemptAsync(today, ct))
        {
            try
            {
                await refreshAllBonds.ExecuteAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Freshness is best-effort; a provider outage must serve stale cache,
                // not fail the caller. The claim already stamped today, so a failed
                // attempt still consumes the day and no marker write belongs here.
            }
        }
    }
}
