using AppName.Application.Dtos;
using AppName.Application.Time;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Returns today's conversion valuation for every cached convertible bond,
/// refreshing the cache once per Taiwan trading day. Refresh is an internal,
/// lazy step — never surfaced as an error to the caller.
/// </summary>
public sealed class GetValuationsUseCase(
    IBondValuationRefreshStateRepository refreshStateRepo,
    IValuationSnapshotRepository snapshotRepo,
    IRefreshAllBondsUseCase refreshAllBonds,
    TimeProvider timeProvider)
{
    /// <summary>
    /// Ensures freshness (best-effort) then returns all cached valuations.
    /// </summary>
    public async Task<IReadOnlyList<ConversionValuationDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var state = await refreshStateRepo.GetAsync(ct);
        var today = TaiwanClock.Today(timeProvider);

        if (state.LastAttemptDate != today)
        {
            try
            {
                await refreshAllBonds.ExecuteAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Freshness is best-effort; a provider outage must serve stale cache,
                // not fail the caller. Snapshots below are whatever we already have.
            }
        }

        var snapshots = await snapshotRepo.GetAllAsync(ct);
        return snapshots.Select(ToDto).ToList();
    }

    private static ConversionValuationDto ToDto(BondValuationSnapshot s) =>
        new(s.Symbol, s.ConversionShares, s.ConversionValue, s.StockPrice, s.AsOf, s.BondPrice, s.IsInTheMoney);
}
