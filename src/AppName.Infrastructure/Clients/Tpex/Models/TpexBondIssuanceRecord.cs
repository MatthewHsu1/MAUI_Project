using System.ComponentModel;
using System.Text.Json.Serialization;

namespace AppName.Infrastructure.Clients.Tpex.Models;

/// <summary>
/// Raw TPEx issuance record (bond_ISSBD5_data) for one convertible bond.
/// </summary>
public sealed class TpexBondIssuanceRecord
{
    /// <summary>
    /// Convertible bond trading symbol.
    /// </summary>
    [DisplayName("Bond Code")]
    [JsonPropertyName("BondCode")]
    public string BondCode { get; set; } = "";

    /// <summary>
    /// Short display name of the bond.
    /// </summary>
    [DisplayName("Short Name")]
    [JsonPropertyName("ShortName")]
    public string ShortName { get; set; } = "";

    /// <summary>
    /// Underlying stock code (the issuer's stock).
    /// </summary>
    [DisplayName("Issuer Code")]
    [JsonPropertyName("IssuerCode")]
    public string IssuerCode { get; set; } = "";

    /// <summary>
    /// Conversion price at issuance, as the raw string the API returns.
    /// </summary>
    [DisplayName("Conversion Price at Issuance")]
    [JsonPropertyName("Conversion/ExchangePriceAtIssuance")]
    public string ConversionPriceAtIssuance { get; set; } = "";
}
