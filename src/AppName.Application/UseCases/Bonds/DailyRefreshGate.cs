using AppName.Application.Time;
using AppName.Domain.Abstractions.Bonds;
using Microsoft.Extensions.Logging;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// The once-per-Taiwan-trading-day refresh gate every valuation read passes
/// through.
/// </summary>
internal static class DailyRefreshGate
{
    /// <summary>
    /// How long a failed attempt blocks the next one.
    /// </summary>
    internal static readonly TimeSpan RetryBackoff = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Refreshes the valuation cache when this caller wins today's claim, and
    /// returns without refreshing when it loses.
    /// </summary>
    /// <param name="refreshStateRepo">Holds the singleton refresh marker the claim updates.</param>
    /// <param name="refreshAllBonds">Runs the whole-market refresh.</param>
    /// <param name="timeProvider">Resolves today's Taiwan trading date.</param>
    /// <param name="logger">Records a failed attempt, which is otherwise invisible to the caller.</param>
    /// <param name="ct">Cancels the claim and the refresh.</param>
    internal static async Task EnsureFreshAsync(
        IBondValuationRefreshStateRepository refreshStateRepo,
        IRefreshAllBondsUseCase refreshAllBonds,
        TimeProvider timeProvider,
        ILogger logger,
        CancellationToken ct)
    {
        // UtcDateTime because the marker is compared in SQL, and EF Core's
        // SQLite provider cannot translate a DateTimeOffset comparison.
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var today = TaiwanClock.Today(timeProvider);

        // A losing claim falls through and serves the cache. It does not wait for
        // the winner, because freshness is best-effort and waiting would couple
        // every window request to one whole-market fetch.
        if (!await refreshStateRepo.TryClaimAttemptAsync(today, now, ct))
        {
            return;
        }

        try
        {
            await refreshAllBonds.ExecuteAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // The caller walked away mid-refresh. Nothing failed, so this is not
            // logged as an error, but the day must still be handed back: an
            // attempt that never finished has not refreshed anything. The retry
            // is immediate because there is no upstream fault to back off from.
            await ReleaseQuietlyAsync(refreshStateRepo, now, logger);
            throw;
        }
        catch (Exception ex)
        {
            // Freshness is best-effort; a provider outage must serve stale cache,
            // not fail the caller. That silence is exactly why this is logged --
            // without it, an empty grid and a working-but-empty market look
            // identical from the outside.
            logger.LogError(
                ex,
                "Daily bond valuation refresh failed for Taiwan date {TaiwanDate}. Serving the cached valuations. The day has been released; the next read after {RetryNotBefore:O} will try again.",
                today,
                now + RetryBackoff);

            await ReleaseQuietlyAsync(refreshStateRepo, now + RetryBackoff, logger);
        }
    }

    /// <summary>
    /// Releases the claim, swallowing any failure to do so.
    /// </summary>
    /// <remarks>
    private static async Task ReleaseQuietlyAsync(
        IBondValuationRefreshStateRepository refreshStateRepo,
        DateTime retryNotBefore,
        ILogger logger)
    {
        try
        {
            await refreshStateRepo.ReleaseClaimAsync(retryNotBefore, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Could not release the bond valuation refresh claim. No further refresh will be attempted until tomorrow.");
        }
    }
}
