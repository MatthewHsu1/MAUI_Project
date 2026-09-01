using AppName.Application.Time;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Application.UseCases.Bonds;

/// <inheritdoc/>
public sealed class RefreshAllBondsUseCase(
    IMarketDataProvider provider,
    IConvertibleBondRepository bondRepo,
    IValuationSnapshotRepository snapshotRepo,
    IBondValuationRefreshStateRepository refreshStateRepo,
    TimeProvider timeProvider) : IRefreshAllBondsUseCase
{
    /// <inheritdoc/>
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        var bonds = await provider.GetAllIssuanceTermsAsync(ct);

        foreach (var bond in bonds)
        {
            await bondRepo.UpsertAsync(bond, ct);
        }

        var symbols = bonds.Select(b => b.Symbol).ToList();
        var underlyings = bonds.Select(b => b.UnderlyingSymbol).ToList();

        var bondQuotes = await provider.GetBondQuotesAsync(symbols, ct);
        var stockQuotes = await provider.GetStockQuotesAsync(underlyings, ct);

        var snapshots = new List<BondValuationSnapshot>();

        foreach (var bond in bonds)
        {
            if (!stockQuotes.TryGetValue(bond.UnderlyingSymbol, out var stock))
            {
                continue; // best-effort: no stock quote → skip this bond
            }

            var v = ConversionValuation.Calculate(bond.ParValue, bond.ConversionPrice, stock.Price);

            decimal? bondPrice = bondQuotes.TryGetValue(bond.Symbol, out var bq) ? bq.Price : null;
            bool? isInTheMoney = bondPrice is { } bp ? v.ConversionValue > bp : null;

            snapshots.Add(new BondValuationSnapshot(
                bond.Symbol, v.ConversionShares, v.ConversionValue, stock.Price, stock.AsOf, bondPrice, isInTheMoney));
        }

        await snapshotRepo.UpsertManyAsync(snapshots, ct);

        var previous = await refreshStateRepo.GetAsync(ct);

        // A pull that produced no usable quotes must not drag LastAsOf backwards.
        // It is the key the refresh gate reads, so a null there would reopen the
        // gate on every read. The pending next-attempt time is carried over for
        // the same reason: this write replaces the whole row, and dropping the
        // lease would let a second caller in behind an in-flight refresh.
        DateOnly? maxAsOf = snapshots.Count > 0 ? snapshots.Max(s => s.AsOf) : previous.LastAsOf;

        await refreshStateRepo.SetAsync(
            new BondValuationRefreshState(
                BondValuationRefreshState.SingletonId,
                maxAsOf,
                TaiwanClock.Today(timeProvider),
                previous.NextAttemptNotBefore), ct);
    }
}
