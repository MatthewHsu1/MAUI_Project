using System.Globalization;
using AppName.Domain.Abstractions.MarketData;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.Entities.Quotes;
using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Twse;
using AppName.Infrastructure.Clients.TwseMis;

namespace AppName.Infrastructure.Gateways;

/// <inheritdoc/>
public sealed class MarketDataProvider(
    ITpexBondIssuanceApiClient issuance,
    ITwseStockQuoteApiClient twseStocks,
    ITpexStockQuoteApiClient tpexStocks,
    ITwseMisBondQuoteApiClient misBonds) : IMarketDataProvider
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
    public async Task<BondQuote?> GetBondQuoteAsync(string bondSymbol, CancellationToken ct = default)
    {
        var quotes = await misBonds.GetQuotesAsync(new[] { bondSymbol }, ct);

        var q = quotes.FirstOrDefault(x => x.Code == bondSymbol);

        if (q is null) return null;

        // z (last trade) may be "-" for illiquid bonds; fall back to y (previous close).
        var pointsRaw = IsNumeric(q.LastPrice) ? q.LastPrice : q.PreviousClose;
        var points = ParseDecimal(pointsRaw);

        if (points <= 0) return null;

        if (ParseMisDate(q.Date) is not { } asOf) return null;

        // MIS quotes CB price as a percentage of par; scale to NT$ so it is
        // comparable with ConversionValue.
        var priceNt = points / 100m * ParValueConvention;

        return new BondQuote(bondSymbol, priceNt, asOf);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<ConvertibleBond>> GetAllIssuanceTermsAsync(CancellationToken ct = default)
    {
        var records = await issuance.GetAllAsync(ct);

        var bonds = new List<ConvertibleBond>();

        foreach (var r in records.DistinctBy(r => r.BondCode))
        {
            var conversionPrice = ParseDecimal(r.ConversionPriceAtIssuance);

            if (conversionPrice <= 0)
            {
                continue; // unparseable/halted upstream row → skip
            }

            bonds.Add(new ConvertibleBond(r.BondCode, r.ShortName, ParValueConvention, conversionPrice, r.IssuerCode));
        }

        return bonds;
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<string, StockQuote>> GetStockQuotesAsync(IEnumerable<string> stockSymbols, CancellationToken ct = default)
    {
        var wanted = stockSymbols.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToHashSet();

        var result = new Dictionary<string, StockQuote>();

        // One TWSE snapshot for the whole batch (preferred source).
        var twse = await twseStocks.GetAllAsync(ct);

        foreach (var t in twse)
        {
            if (!wanted.Contains(t.Code) || result.ContainsKey(t.Code)) continue;

            if (ParseRocDate(t.Date) is { } asOf)
            {
                result[t.Code] = new StockQuote(t.Code, ParseDecimal(t.ClosingPrice), asOf);
            }
        }

        // One TPEx OTC snapshot for anything TWSE did not resolve.
        var otc = await tpexStocks.GetAllAsync(ct);

        foreach (var o in otc)
        {
            if (!wanted.Contains(o.SecuritiesCompanyCode) || result.ContainsKey(o.SecuritiesCompanyCode)) continue;

            if (ParseRocDate(o.Date) is { } asOf)
            {
                result[o.SecuritiesCompanyCode] = new StockQuote(o.SecuritiesCompanyCode, ParseDecimal(o.Close), asOf);
            }
        }

        return result;
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<string, BondQuote>> GetBondQuotesAsync(IEnumerable<string> bondSymbols, CancellationToken ct = default)
    {
        var codes = bondSymbols.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList();

        var quotes = await misBonds.GetQuotesAsync(codes, ct);

        var result = new Dictionary<string, BondQuote>();

        foreach (var q in quotes)
        {
            if (result.ContainsKey(q.Code)) continue;

            // z (last trade) may be "-" for illiquid bonds; fall back to y (previous close).
            var pointsRaw = IsNumeric(q.LastPrice) ? q.LastPrice : q.PreviousClose;
            var points = ParseDecimal(pointsRaw);

            if (points <= 0) continue;

            if (ParseMisDate(q.Date) is not { } asOf) continue;

            // MIS quotes CB price as a percentage of par; scale to NT$.
            var priceNt = points / 100m * ParValueConvention;

            result[q.Code] = new BondQuote(q.Code, priceNt, asOf);
        }

        return result;
    }

    private static decimal ParseDecimal(string raw) =>
        decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    private static bool IsNumeric(string raw) =>
        decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out _);

    /// <summary>
    /// Converts a TWSE MIS Gregorian date string ("20260702") to a DateOnly.
    /// Returns null when the input is not a valid 8-char yyyyMMdd date.
    /// </summary>
    internal static DateOnly? ParseMisDate(string raw) =>
        DateOnly.TryParseExact(raw, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : null;

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
