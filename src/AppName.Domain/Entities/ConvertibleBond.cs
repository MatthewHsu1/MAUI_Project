using System.ComponentModel;

namespace AppName.Domain.Entities;

/// <summary>
/// A convertible corporate bond and its static conversion terms.
/// </summary>
public sealed class ConvertibleBond
{
    /// <summary>
    /// Creates a convertible bond. Throws when the symbol is blank.
    /// </summary>
    public ConvertibleBond(string symbol, string name, decimal parValue, decimal conversionPrice, string underlyingSymbol)
    {
        if (string.IsNullOrWhiteSpace(symbol))
            throw new ArgumentException("Symbol cannot be blank.", nameof(symbol));

        Symbol = symbol;
        Name = name;
        ParValue = parValue;
        ConversionPrice = conversionPrice;
        UnderlyingSymbol = underlyingSymbol;
    }

    /// <summary>
    /// Exchange ticker of the convertible bond (e.g. "11011").
    /// </summary>
    [DisplayName("Bond Symbol")]
    public string Symbol { get; }

    /// <summary>
    /// Display name of the bond.
    /// </summary>
    [DisplayName("Bond Name")]
    public string Name { get; }

    /// <summary>
    /// Face/issue value per bond unit (發行面額); NT$100,000 by convention.
    /// </summary>
    [DisplayName("Par Value")]
    public decimal ParValue { get; private set; }

    /// <summary>
    /// Price at which the bond converts into shares (轉換價).
    /// </summary>
    [DisplayName("Conversion Price")]
    public decimal ConversionPrice { get; private set; }

    /// <summary>
    /// Ticker of the underlying stock the bond converts into (the issuer's stock).
    /// </summary>
    [DisplayName("Underlying Symbol")]
    public string UnderlyingSymbol { get; }

    /// <summary>
    /// Replaces the static terms (e.g. after an anti-dilution adjustment).
    /// </summary>
    public void UpdateTerms(decimal parValue, decimal conversionPrice)
    {
        ParValue = parValue;
        ConversionPrice = conversionPrice;
    }
}
