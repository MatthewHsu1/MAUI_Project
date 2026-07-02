using System.ComponentModel;
using System.Text.Json.Serialization;

namespace AppName.Infrastructure.Clients.TwseMis.Models;

/// <summary>
/// Raw TWSE MIS getStockInfo.jsp envelope wrapping one or more quote records.
/// </summary>
public sealed class TwseMisResponse
{
    /// <summary>
    /// Result code; "0000" means success.
    /// </summary>
    [DisplayName("Result Code")]
    [JsonPropertyName("rtcode")]
    public string RtCode { get; set; } = "";

    /// <summary>
    /// Human-readable result message.
    /// </summary>
    [DisplayName("Result Message")]
    [JsonPropertyName("rtmessage")]
    public string RtMessage { get; set; } = "";

    /// <summary>
    /// The per-security quote records; null or empty when nothing matched.
    /// </summary>
    [DisplayName("Quotes")]
    [JsonPropertyName("msgArray")]
    public List<TwseMisQuoteRecord>? MsgArray { get; set; }
}
