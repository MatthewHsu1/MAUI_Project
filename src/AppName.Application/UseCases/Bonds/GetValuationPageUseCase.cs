using AppName.Application.Dtos.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns one window of cached conversion valuations together with the total the
/// same filter matches, refreshing the cache once per Taiwan trading day. Refresh
/// is an internal, lazy step — never surfaced as an error to the caller.
/// </summary>
/// <remarks>
/// This use case returns both halves because its caller sends a nested filter
/// tree. Split into a slice call and a count call, that caller would send the same
/// tree twice, and two trees can disagree, so the total would size a window it
/// does not describe. The eight flat filters of the grid path are cheap to repeat,
/// which is why <see cref="GetValuationsUseCase"/> and
/// <see cref="GetValuationCountUseCase"/> stay separate there.
/// </remarks>
public sealed class GetValuationPageUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns the slice and the filtered total.
    /// </summary>
    /// <param name="query">The filter, the sort, and the window to read.</param>
    /// <param name="ct">Cancels the refresh, the read, and the count.</param>
    public async Task<ValuationPage> ExecuteAsync(ValuationQuery query, CancellationToken ct = default)
    {
        await DailyRefreshGate.EnsureFreshAsync(refreshStateRepo, refreshAllBonds, timeProvider, ct);

        var snapshots = await snapshotRepo.QueryAsync(query, ct);

        // The count reads the filter alone. The window must not change the total,
        // or the scrollbar would shrink as the caller scrolls.
        var total = await snapshotRepo.CountAsync(query.Filter, ct);

        return new ValuationPage(snapshots.Select(ValuationSnapshotMapper.ToDto).ToList(), total);
    }
}
