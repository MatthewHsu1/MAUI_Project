using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns how many cached valuations one filter matches, refreshing the cache
/// once per Taiwan trading day. Refresh is an internal, lazy step — never
/// surfaced as an error to the caller.
/// </summary>
/// <remarks>
/// The grid keeps its row count in a query of its own, so this path can arrive
/// before any window query. It therefore passes the same refresh gate; whichever
/// request arrives first wins the day.
/// </remarks>
public sealed class GetValuationCountUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns the filtered total.
    /// </summary>
    /// <param name="filter">The filter to count. Paging cannot change a count, so it takes no window.</param>
    /// <param name="ct">Cancels the refresh and the count.</param>
    public async Task<int> ExecuteAsync(ValuationFilter filter, CancellationToken ct = default)
    {
        await DailyRefreshGate.EnsureFreshAsync(refreshStateRepo, refreshAllBonds, timeProvider, ct);

        return await snapshotRepo.CountAsync(filter, ct);
    }
}
