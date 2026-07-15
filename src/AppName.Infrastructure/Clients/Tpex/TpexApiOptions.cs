namespace AppName.Infrastructure.Clients.Tpex;

/// <summary>
/// Configuration for the TPEx open-data HTTP clients.
/// </summary>
public sealed class TpexApiOptions
{
    /// <summary>
    /// Base address of the TPEx OpenAPI v1 host.
    /// </summary>
    public string BaseUrl { get; set; } = "https://www.tpex.org.tw/openapi/v1/";

    /// <summary>
    /// User-Agent sent with requests (TPEx blocks empty/automated agents).
    /// </summary>
    public string UserAgent { get; set; } = "Mozilla/5.0 (compatible; AppName/1.0)";
}
