namespace AppName.Infrastructure.Clients.TwseMis;

/// <summary>
/// Configuration for the TWSE MIS quote HTTP client.
/// </summary>
public sealed class TwseMisApiOptions
{
    /// <summary>
    /// Base address of the TWSE MIS stock-quote API host.
    /// </summary>
    public string BaseUrl { get; set; } = "https://mis.twse.com.tw/stock/api/";

    /// <summary>
    /// User-Agent sent with requests.
    /// </summary>
    public string UserAgent { get; set; } = "Mozilla/5.0 (compatible; AppName/1.0)";

    /// <summary>
    /// Referer header the MIS service requires to serve quote data.
    /// </summary>
    public string Referer { get; set; } = "https://mis.twse.com.tw/stock/index.jsp";
}
