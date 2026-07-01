using System.ComponentModel;
using System.Text.Json.Serialization;

namespace AppName.Infrastructure.Clients.Tpex.Models;

/// <summary>
/// Raw TPEx OTC daily closing-price record (tpex_mainboard_quotes) for one stock.
/// </summary>
public sealed class TpexStockQuoteRecord
{
    /// <summary>
    /// OTC stock ticker code.
    /// </summary>
    [DisplayName("Stock Code")]
    [JsonPropertyName("SecuritiesCompanyCode")]
    public string SecuritiesCompanyCode { get; set; } = "";

    /// <summary>
    /// Closing price as the raw string the API returns.
    /// </summary>
    [DisplayName("Closing Price")]
    [JsonPropertyName("Close")]
    public string Close { get; set; } = "";

    /// <summary>
    /// Trading date in ROC format (e.g. "1150630").
    /// </summary>
    [DisplayName("Trading Date")]
    [JsonPropertyName("Date")]
    public string Date { get; set; } = "";
}
