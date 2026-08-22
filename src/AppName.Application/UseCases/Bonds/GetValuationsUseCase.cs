using AppName.Application.Dtos;
using AppName.Domain.Abstractions;
using AppName.Domain.ValueObjects;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns one window of cached conversion valuations, ordered and filtered as
/// the query asks, refreshing the cache once per Taiwan trading day. Refresh is
/// an internal, lazy step — never surfaced as an error to the caller.
/// </summary>
public sealed class GetValuationsUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns the requested slice.
    /// </summary>
    /// <param name="query">The filter, the sort, and the window to read.</param>
    /// <param name="ct">Cancels the refresh and the read.</param>
    public async Task<IReadOnlyList<ConversionValuationDto>> ExecuteAsync(
        ValuationQuery query, CancellationToken ct = default)
    {
        await DailyRefreshGate.EnsureFreshAsync(refreshStateRepo, refreshAllBonds, timeProvider, ct);

        var snapshots = await snapshotRepo.QueryAsync(query, ct);
        return snapshots.Select(ValuationSnapshotMapper.ToDto).ToList();
    }
}
