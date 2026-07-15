using System.ComponentModel;
using System.Text.Json.Serialization;

namespace AppName.Infrastructure.Clients.TwseMis.Models;

/// <summary>
/// Raw TWSE MIS quote record (one security) from getStockInfo.jsp. Values are the
/// raw strings the service returns; a last-price of "-" means no trade yet today.
/// </summary>
public sealed class TwseMisQuoteRecord
{
    /// <summary>
    /// Security code (the convertible-bond ticker).
    /// </summary>
    [DisplayName("Security Code")]
    [JsonPropertyName("c")]
    public string Code { get; set; } = "";

    /// <summary>
    /// Latest trade price ("z"); "-" when the bond has not traded today.
    /// </summary>
    [DisplayName("Last Price")]
    [JsonPropertyName("z")]
    public string LastPrice { get; set; } = "";

    /// <summary>
    /// Previous trading day's closing price ("y"); always present.
    /// </summary>
    [DisplayName("Previous Close")]
    [JsonPropertyName("y")]
    public string PreviousClose { get; set; } = "";

    /// <summary>
    /// Trade date in Gregorian format "yyyyMMdd" (e.g. "20260702").
    /// </summary>
    [DisplayName("Trade Date")]
    [JsonPropertyName("d")]
    public string Date { get; set; } = "";

    /// <summary>
    /// Short display name of the security.
    /// </summary>
    [DisplayName("Name")]
    [JsonPropertyName("n")]
    public string Name { get; set; } = "";

    /// <summary>
    /// Market channel the quote came from (e.g. "otc").
    /// </summary>
    [DisplayName("Market")]
    [JsonPropertyName("ex")]
    public string Market { get; set; } = "";
}
