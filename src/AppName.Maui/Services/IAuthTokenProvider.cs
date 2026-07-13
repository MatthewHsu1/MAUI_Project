namespace AppName.Maui.Services;

/// <summary>
/// Supplies a bearer token for authenticated calls to AppName.Api.
/// </summary>
public interface IAuthTokenProvider
{
    /// <summary>
    /// Returns a valid bearer token, minting and caching a new one if none
    /// is cached or the cached token has expired.
    /// </summary>
    Task<string> GetTokenAsync(CancellationToken ct = default);
}
