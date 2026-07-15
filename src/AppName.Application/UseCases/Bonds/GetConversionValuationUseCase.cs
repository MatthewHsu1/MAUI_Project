using AppName.Application.Dtos;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using AppName.Domain.ValueObjects;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Reads a cached bond plus a live underlying stock price and computes its
/// conversion valuation.
/// </summary>
public sealed class GetConversionValuationUseCase(IConvertibleBondRepository repo, IMarketDataProvider provider)
{
    /// <summary>
    /// Returns the valuation DTO, or null when the bond is not cached or its stock
    /// quote is unavailable. BondPrice/IsInTheMoney are populated from the live CB
    /// quote when available, and left null when no bond quote can be fetched or the
    /// fetch fails.
    /// </summary>
    public async Task<ConversionValuationDto?> ExecuteAsync(string bondSymbol, CancellationToken ct = default)
    {
        var bond = await repo.GetBySymbolAsync(bondSymbol, ct);

        if (bond is null) return null;

        var stockQuote = await provider.GetStockQuoteAsync(bond.UnderlyingSymbol, ct);

        if (stockQuote is null) return null;

        var v = ConversionValuation.Calculate(bond.ParValue, bond.ConversionPrice, stockQuote.Price);

        BondQuote? bondQuote;

        try
        {
            bondQuote = await provider.GetBondQuoteAsync(bondSymbol, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Bond price is a best-effort enrichment; a source outage must not break the
            // core stock-based valuation. Degrade to no bond price (see spec §5.3).
            bondQuote = null;
        }

        decimal? bondPrice = bondQuote?.Price;
        bool? isInTheMoney = bondPrice is { } bp ? v.ConversionValue > bp : null;

        return new ConversionValuationDto(
            bond.Symbol, v.ConversionShares, v.ConversionValue, stockQuote.Price, stockQuote.AsOf,
            BondPrice: bondPrice, IsInTheMoney: isInTheMoney);
    }
}
