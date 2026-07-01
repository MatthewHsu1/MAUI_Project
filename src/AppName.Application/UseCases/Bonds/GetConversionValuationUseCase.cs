using AppName.Application.Dtos;
using AppName.Domain.Abstractions;
using AppName.Domain.ValueObjects;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Reads a cached bond plus a live underlying stock price and computes its
/// conversion valuation.
/// </summary>
public sealed class GetConversionValuationUseCase(IConvertibleBondRepository repo, IMarketDataProvider provider)
{
    /// <summary>
    /// Returns the valuation DTO, or null when the bond is not cached or
    /// its stock quote is unavailable. BondPrice/IsInTheMoney are left
    /// null: the CB market price source is deferred (see spec §2).
    /// </summary>
    public async Task<ConversionValuationDto?> ExecuteAsync(string bondSymbol, CancellationToken ct = default)
    {
        var bond = await repo.GetBySymbolAsync(bondSymbol, ct);

        if (bond is null) return null;

        var stockQuote = await provider.GetStockQuoteAsync(bond.UnderlyingSymbol, ct);

        if (stockQuote is null) return null;

        var v = ConversionValuation.Calculate(bond.ParValue, bond.ConversionPrice, stockQuote.Price);
        
        return new ConversionValuationDto(
            bond.Symbol, v.ConversionShares, v.ConversionValue, stockQuote.Price, stockQuote.AsOf,
            BondPrice: null, IsInTheMoney: null);
    }
}
