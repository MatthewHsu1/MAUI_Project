using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.Extensions.Logging;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns how many cached valuations one filter matches, refreshing the cache
/// once per Taiwan trading day. Refresh is an internal, lazy step — never
/// surfaced as an error to the caller.
public sealed class GetValuationCountUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider,
    ILogger<GetValuationCountUseCase> logger)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns the filtered total.
    /// </summary>
    /// <param name="filter">The filter to count. Paging cannot change a count, so it takes no window.</param>
    /// <param name="ct">Cancels the refresh and the count.</param>
    public async Task<int> ExecuteAsync(ValuationFilter filter, CancellationToken ct = default)
    {
        await DailyRefreshGate.EnsureFreshAsync(refreshStateRepo, refreshAllBonds, timeProvider, logger, ct);

        return await snapshotRepo.CountAsync(filter, ct);
    }
}
