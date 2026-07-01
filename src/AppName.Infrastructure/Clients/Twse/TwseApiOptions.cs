namespace AppName.Infrastructure.Clients.Twse;

/// <summary>
/// Configuration for the TWSE open-data HTTP client.
/// </summary>
public sealed class TwseApiOptions
{
    /// <summary>
    /// Base address of the TWSE OpenAPI v1 host.
    /// </summary>
    public string BaseUrl { get; set; } = "https://openapi.twse.com.tw/v1/";

    /// <summary>
    /// User-Agent sent with requests.
    /// </summary>
    public string UserAgent { get; set; } = "Mozilla/5.0 (compatible; AppName/1.0)";
}
