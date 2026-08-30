using AppName.Application.Dtos.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.Extensions.Logging;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns one window of cached conversion valuations together with the total the
/// same filter matches, refreshing the cache once per Taiwan trading day. Refresh
/// is an internal, lazy step — never surfaced as an error to the caller.
/// </summary>
public sealed class GetValuationPageUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider,
    ILogger<GetValuationPageUseCase> logger)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns the slice and the filtered total.
    /// </summary>
    /// <param name="query">The filter, the sort, and the window to read.</param>
    /// <param name="ct">Cancels the refresh, the read, and the count.</param>
    public async Task<ValuationPage> ExecuteAsync(ValuationQuery query, CancellationToken ct = default)
    {
        await DailyRefreshGate.EnsureFreshAsync(refreshStateRepo, refreshAllBonds, timeProvider, logger, ct);

        var snapshots = await snapshotRepo.QueryAsync(query, ct);

        // The count reads the filter alone. The window must not change the total,
        // or the scrollbar would shrink as the caller scrolls.
        var total = await snapshotRepo.CountAsync(query.Filter, ct);

        return new ValuationPage(snapshots.Select(ValuationSnapshotMapper.ToDto).ToList(), total);
    }
}
