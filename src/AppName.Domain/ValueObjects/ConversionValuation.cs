using System.ComponentModel;

namespace AppName.Domain.ValueObjects;

/// <summary>
/// Conversion economics of a convertible bond at a point in time (shares + value).
/// </summary>
public sealed class ConversionValuation
{
    private ConversionValuation(decimal shares, decimal value)
    {
        ConversionShares = shares;
        ConversionValue = value;
    }

    /// <summary>
    /// Number of shares the bond converts into (par value / conversion price).
    /// </summary>
    [DisplayName("Conversion Shares")]
    public decimal ConversionShares { get; }

    /// <summary>
    /// Market value of the converted shares (shares × stock price).
    /// </summary>
    [DisplayName("Conversion Value")]
    public decimal ConversionValue { get; }

    /// <summary>
    /// Computes shares and value. Throws when conversion price is not positive.
    /// </summary>
    public static ConversionValuation Calculate(decimal parValue, decimal conversionPrice, decimal stockPrice)
    {
        if (conversionPrice <= 0)
            throw new ArgumentOutOfRangeException(nameof(conversionPrice), "Conversion price must be positive.");

        var shares = parValue / conversionPrice;
        return new ConversionValuation(shares, shares * stockPrice);
    }
}
