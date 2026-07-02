using System.ComponentModel;

namespace AppName.Domain.Entities;

/// <summary>
/// A cached conversion valuation for one convertible bond on a given trading day.
/// </summary>
public sealed class BondValuationSnapshot
{
    /// <summary>
    /// Creates a valuation snapshot. Throws when the symbol is blank.
    /// </summary>
    public BondValuationSnapshot(
        string symbol,
        decimal conversionShares,
        decimal conversionValue,
        decimal stockPrice,
        DateOnly asOf,
        decimal? bondPrice,
        bool? isInTheMoney)
    {
        if (string.IsNullOrWhiteSpace(symbol))
            throw new ArgumentException("Symbol cannot be blank.", nameof(symbol));

        Symbol = symbol;
        ConversionShares = conversionShares;
        ConversionValue = conversionValue;
        StockPrice = stockPrice;
        AsOf = asOf;
        BondPrice = bondPrice;
        IsInTheMoney = isInTheMoney;
    }

    /// <summary>
    /// Exchange ticker of the convertible bond.
    /// </summary>
    [DisplayName("Bond Symbol")]
    public string Symbol { get; }

    /// <summary>
    /// Number of shares the bond converts into (par value / conversion price).
    /// </summary>
    [DisplayName("Conversion Shares")]
    public decimal ConversionShares { get; private set; }

    /// <summary>
    /// Market value of the converted shares (shares × stock price), in NT$.
    /// </summary>
    [DisplayName("Conversion Value")]
    public decimal ConversionValue { get; private set; }

    /// <summary>
    /// Underlying stock's price used to compute this valuation.
    /// </summary>
    [DisplayName("Stock Price")]
    public decimal StockPrice { get; private set; }

    /// <summary>
    /// Trading date this valuation applies to.
    /// </summary>
    [DisplayName("As Of")]
    public DateOnly AsOf { get; private set; }

    /// <summary>
    /// Market price of the bond in NT$, or null when no bond quote was available.
    /// </summary>
    [DisplayName("Bond Price")]
    public decimal? BondPrice { get; private set; }

    /// <summary>
    /// Whether the bond is in the money; null when <see cref="BondPrice"/> is null.
    /// </summary>
    [DisplayName("In The Money")]
    public bool? IsInTheMoney { get; private set; }

    /// <summary>
    /// Replaces this snapshot's daily values with a fresh valuation.
    /// </summary>
    public void Update(
        decimal conversionShares,
        decimal conversionValue,
        decimal stockPrice,
        DateOnly asOf,
        decimal? bondPrice,
        bool? isInTheMoney)
    {
        ConversionShares = conversionShares;
        ConversionValue = conversionValue;
        StockPrice = stockPrice;
        AsOf = asOf;
        BondPrice = bondPrice;
        IsInTheMoney = isInTheMoney;
    }
}
