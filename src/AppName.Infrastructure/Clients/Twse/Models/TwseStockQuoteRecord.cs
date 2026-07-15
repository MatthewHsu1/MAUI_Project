using System.ComponentModel;
using System.Text.Json.Serialization;

namespace AppName.Infrastructure.Clients.Twse.Models;

/// <summary>
/// Raw TWSE daily closing-price record (STOCK_DAY_ALL) for one stock.
/// </summary>
public sealed class TwseStockQuoteRecord
{
    /// <summary>
    /// Stock ticker symbol.
    /// </summary>
    [DisplayName("Stock Code")]
    [JsonPropertyName("Code")]
    public string Code { get; set; } = "";

    /// <summary>
    /// Closing price as the raw string the API returns.
    /// </summary>
    [DisplayName("Closing Price")]
    [JsonPropertyName("ClosingPrice")]
    public string ClosingPrice { get; set; } = "";

    /// <summary>
    /// Trading date in ROC format (e.g. "1150629").
    /// </summary>
    [DisplayName("Trading Date")]
    [JsonPropertyName("Date")]
    public string Date { get; set; } = "";
}
