using AppName.Domain.Entities.Bonds;
using AppName.Domain.Entities.Quotes;

namespace AppName.Domain.Abstractions.MarketData;

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

    /// <summary>
    /// Gets the static conversion terms for every convertible bond in the TPEx
    /// issuance dataset (rows with an unusable conversion price are skipped).
    /// </summary>
    Task<IReadOnlyList<ConvertibleBond>> GetAllIssuanceTermsAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets the latest daily quote for each requested underlying stock, resolved
    /// against a single TWSE snapshot then a single TPEx snapshot. Symbols with no
    /// usable quote are omitted from the result.
    /// </summary>
    Task<IReadOnlyDictionary<string, StockQuote>> GetStockQuotesAsync(IEnumerable<string> stockSymbols, CancellationToken ct = default);

    /// <summary>
    /// Gets the latest MIS market quote for each requested convertible bond, in NT$.
    /// Bonds with no usable price are omitted from the result.
    /// </summary>
    Task<IReadOnlyDictionary<string, BondQuote>> GetBondQuotesAsync(IEnumerable<string> bondSymbols, CancellationToken ct = default);
}
