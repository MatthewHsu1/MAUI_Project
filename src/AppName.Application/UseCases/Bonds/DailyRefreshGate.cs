using AppName.Application.Time;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Bonds;
using Microsoft.Extensions.Logging;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// The refresh gate every valuation read passes through, which brings the
/// cache up to the newest published Taiwan trading data and then leaves it alone.
/// </summary>
internal static class DailyRefreshGate
{
    /// <summary>
    /// How long a failed attempt blocks the next one.
    /// </summary>
    internal static readonly TimeSpan RetryBackoff = TimeSpan.FromMinutes(5);

    /// <summary>
    /// How long an attempt that brought back no newer data blocks the next one.
    /// </summary>
    internal static readonly TimeSpan StalePollInterval = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Refreshes the valuation cache when this caller wins the claim, and
    /// returns without refreshing when it loses.
    /// </summary>
    /// <param name="refreshStateRepo">Holds the singleton refresh marker the claim updates.</param>
    /// <param name="refreshAllBonds">Runs the whole-market refresh.</param>
    /// <param name="timeProvider">Resolves the Taiwan trading dates the claim is judged against.</param>
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

        var claim = new BondValuationRefreshClaim
        {
            ExpectedDataDate = TaiwanClock.ExpectedDataDate(timeProvider),
            TaiwanToday = today,
            IsClosePublishGraceOpen = TaiwanClock.IsClosePublishGraceOpen(timeProvider),
            Now = now,
            NextAttemptNotBefore = now + StalePollInterval,
        };

        // A losing claim falls through and serves the cache -- either the cache
        // already carries the newest published data, or another caller is fetching
        // it. It does not wait for that caller, because freshness is best-effort
        // and waiting would couple every window request to one whole-market fetch.
        if (!await refreshStateRepo.TryClaimAttemptAsync(claim, ct))
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
            // logged as an error, but the lease must still be dropped: an attempt
            // that never finished has not refreshed anything. The next attempt is
            // immediate because there is no upstream fault to back off from.
            await SetNextAttemptQuietlyAsync(refreshStateRepo, now, logger);
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
                "Bond valuation refresh failed for Taiwan date {TaiwanDate}. Serving the cached valuations. The next read after {NextAttemptNotBefore:O} will try again.",
                today,
                now + RetryBackoff);

            await SetNextAttemptQuietlyAsync(refreshStateRepo, now + RetryBackoff, logger);
            return;
        }

        // A successful pull rewrites the whole marker row. Restoring the interval
        // is what paces the retries when the pull succeeded but came back with
        // nothing newer than the cache already held.
        await SetNextAttemptQuietlyAsync(refreshStateRepo, now + StalePollInterval, logger);
    }

    /// <summary>
    /// Records when the next attempt may run, swallowing any failure to do so.
    /// </summary>
    private static async Task SetNextAttemptQuietlyAsync(
        IBondValuationRefreshStateRepository refreshStateRepo,
        DateTime notBefore,
        ILogger logger)
    {
        try
        {
            await refreshStateRepo.SetNextAttemptAsync(notBefore, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Could not schedule the next bond valuation refresh attempt. No further refresh will be attempted until the claim's lease expires.");
        }
    }
}
