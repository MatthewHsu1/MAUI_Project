using System.ComponentModel;

namespace AppName.Application.Dtos;

/// <summary>
/// Conversion valuation result for display. <see cref="BondPrice"/> and
/// <see cref="IsInTheMoney"/> are null until the CB market-price source is
/// implemented (deferred — see spec §2).
/// </summary>
public record ConversionValuationDto
{
    /// <summary>
    /// Creates a conversion valuation result.
    /// </summary>
    public ConversionValuationDto(
        string Symbol,
        decimal ConversionShares,
        decimal ConversionValue,
        decimal StockPrice,
        DateOnly AsOf,
        decimal? BondPrice,
        bool? IsInTheMoney)
    {
        this.Symbol = Symbol;
        this.ConversionShares = ConversionShares;
        this.ConversionValue = ConversionValue;
        this.StockPrice = StockPrice;
        this.AsOf = AsOf;
        this.BondPrice = BondPrice;
        this.IsInTheMoney = IsInTheMoney;
    }

    /// <summary>
    /// Exchange ticker of the convertible bond.
    /// </summary>
    [DisplayName("Bond Symbol")]
    public string Symbol { get; init; }

    /// <summary>
    /// Number of shares the bond converts into (par value / conversion price).
    /// </summary>
    [DisplayName("Conversion Shares")]
    public decimal ConversionShares { get; init; }

    /// <summary>
    /// Market value of the converted shares (shares × stock price).
    /// </summary>
    [DisplayName("Conversion Value")]
    public decimal ConversionValue { get; init; }

    /// <summary>
    /// Underlying stock's price used to compute this valuation.
    /// </summary>
    [DisplayName("Stock Price")]
    public decimal StockPrice { get; init; }

    /// <summary>
    /// Trading date the underlying stock price applies to.
    /// </summary>
    [DisplayName("As Of")]
    public DateOnly AsOf { get; init; }

    /// <summary>
    /// Market price of the bond itself. Null in v1: the CB market price
    /// source is deferred (see spec §2).
    /// </summary>
    [DisplayName("Bond Price")]
    public decimal? BondPrice { get; init; }

    /// <summary>
    /// Whether the bond is currently in the money. Null in v1: depends on
    /// <see cref="BondPrice"/>, which is deferred (see spec §2).
    /// </summary>
    [DisplayName("In The Money")]
    public bool? IsInTheMoney { get; init; }
}
