using System.Globalization;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Twse;

namespace AppName.Infrastructure.Gateways;

/// <inheritdoc/>
public sealed class MarketDataProvider(
    ITpexBondIssuanceApiClient issuance,
    ITwseStockQuoteApiClient twseStocks,
    ITpexStockQuoteApiClient tpexStocks) : IMarketDataProvider
{
    private const decimal ParValueConvention = 100_000m;

    /// <inheritdoc/>
    public async Task<ConvertibleBond?> GetIssuanceTermsAsync(string bondSymbol, CancellationToken ct = default)
    {
        var records = await issuance.GetAllAsync(ct);

        var r = records.FirstOrDefault(x => x.BondCode == bondSymbol);

        if (r is null)
        {
            return null;
        }

        var conversionPrice = ParseDecimal(r.ConversionPriceAtIssuance);

        if (conversionPrice <= 0)
        {
            return null; // unparseable/halted upstream row → no usable record
        }

        return new ConvertibleBond(r.BondCode, r.ShortName, ParValueConvention, conversionPrice, r.IssuerCode);
    }

    /// <inheritdoc/>
    public async Task<StockQuote?> GetStockQuoteAsync(string stockSymbol, CancellationToken ct = default)
    {
        var twse = await twseStocks.GetAllAsync(ct);

        var t = twse.FirstOrDefault(x => x.Code == stockSymbol);

        if (t is not null && ParseRocDate(t.Date) is { } twseAsOf)
        {
            return new StockQuote(t.Code, ParseDecimal(t.ClosingPrice), twseAsOf);
        }

        var otc = await tpexStocks.GetAllAsync(ct);

        var o = otc.FirstOrDefault(x => x.SecuritiesCompanyCode == stockSymbol);

        if (o is not null && ParseRocDate(o.Date) is { } otcAsOf)
        {
            return new StockQuote(o.SecuritiesCompanyCode, ParseDecimal(o.Close), otcAsOf);
        }

        return null;
    }

    /// <inheritdoc/>
    public Task<BondQuote?> GetBondQuoteAsync(string bondSymbol, CancellationToken ct = default)
        => throw new NotImplementedException(
            "CB market price is not available from any free JSON API; it requires scraping the JS-gated TPEx " +
            "page (NewCB_day_qry.php). Deferred — see spec §2.");

    private static decimal ParseDecimal(string raw) =>
        decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    /// <summary>
    /// Converts a Taiwan ROC date string ("1150629") to a Gregorian DateOnly (year = ROC + 1911).
    /// Returns null when the input is not a valid 7-char ROC date.
    /// </summary>
    internal static DateOnly? ParseRocDate(string raw)
    {
        if (raw.Length == 7 &&
            int.TryParse(raw.AsSpan(0, 3), out var yyy) &&
            int.TryParse(raw.AsSpan(3, 2), out var mm) &&
            int.TryParse(raw.AsSpan(5, 2), out var dd))
        {
            return new DateOnly(yyy + 1911, mm, dd);
        }

        return null;
    }
}
