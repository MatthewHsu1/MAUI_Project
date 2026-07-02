using AppName.Domain.Entities;

namespace AppName.Domain.Abstractions;

/// <summary>
/// Pulls convertible-bond reference data and daily prices from an external market-data source.
/// </summary>
public interface IMarketDataProvider
{
    /// <summary>
    /// Gets the static conversion terms for a bond, or null if not found.
    /// </summary>
    Task<ConvertibleBond?> GetIssuanceTermsAsync(string bondSymbol, CancellationToken ct = default);

    /// <summary>
    /// Gets the latest daily quote for an underlying stock, or null if not found.
    /// </summary>
    Task<StockQuote?> GetStockQuoteAsync(string stockSymbol, CancellationToken ct = default);

    /// <summary>
    /// Gets the latest market quote for a convertible bond from the TWSE MIS
    /// service, or null when no usable price is available (bond not found, no
    /// tradable price, or an unparseable quote). Returns the price in NT$.
    /// </summary>
    Task<BondQuote?> GetBondQuoteAsync(string bondSymbol, CancellationToken ct = default);
}
