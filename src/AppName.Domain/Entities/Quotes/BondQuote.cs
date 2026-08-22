using System.ComponentModel;

namespace AppName.Domain.Entities.Quotes;

/// <summary>
/// A convertible bond's market price on a given trading day.
/// </summary>
/// <remarks>
/// Creates a bond quote.
/// </remarks>
public sealed class BondQuote(string bondSymbol, decimal price, DateOnly asOf)
{
    /// <summary>
    /// Ticker of the convertible bond.
    /// </summary>
    [DisplayName("Bond Symbol")]
    public string BondSymbol { get; } = bondSymbol;

    /// <summary>
    /// Closing market price of the bond.
    /// </summary>
    [DisplayName("Bond Price")]
    public decimal Price { get; } = price;

    /// <summary>
    /// Trading date this quote applies to.
    /// </summary>
    [DisplayName("As Of")]
    public DateOnly AsOf { get; } = asOf;
}
