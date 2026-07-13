using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace AppName.Maui.Services;

/// <inheritdoc/>
/// <remarks>
/// LOCAL-DEV STUB ONLY. Calls the anonymous <c>POST /api/auth/token</c>
/// endpoint on AppName.Api, which mints a JWT for a hardcoded placeholder
/// user with no credential check whatsoever. The token is cached in memory
/// for the lifetime of the app and refreshed shortly before it expires. This
/// must be replaced by a real sign-in flow (e.g. OIDC) before the app talks
/// to anything other than a local dev API.
/// </remarks>
public sealed class DevAuthTokenProvider(IHttpClientFactory httpClientFactory) : IAuthTokenProvider
{
    /// <summary>
    /// Name of the named <see cref="HttpClient"/> used to reach the dev
    /// token endpoint. Deliberately separate from the bond-valuation client
    /// pipeline so the bearer-token handler is never attached to it (which
    /// would otherwise recurse back into this provider).
    /// </summary>
    internal const string AuthClientName = "AppName.Maui.AuthClient";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private string? _cachedToken;
    private DateTimeOffset _expiresAt = DateTimeOffset.MinValue;

    /// <inheritdoc/>
    public async Task<string> GetTokenAsync(CancellationToken ct = default)
    {
        if (TryGetCachedToken(out var cached))
        {
            return cached;
        }

        await _gate.WaitAsync(ct);
        try
        {
            if (TryGetCachedToken(out cached))
            {
                return cached;
            }

            var client = httpClientFactory.CreateClient(AuthClientName);
            using var response = await client.PostAsync("auth/token", content: null, ct);
            response.EnsureSuccessStatusCode();

            var payload = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct)
                ?? throw new InvalidOperationException("Dev auth token endpoint returned no content.");

            _cachedToken = payload.AccessToken;
            // 1-minute safety margin so a token never expires mid-request.
            _expiresAt = DateTimeOffset.UtcNow.AddSeconds(payload.ExpiresIn) - TimeSpan.FromMinutes(1);

            return _cachedToken;
        }
        finally
        {
            _gate.Release();
        }
    }

    private bool TryGetCachedToken(out string token)
    {
        if (_cachedToken is not null && DateTimeOffset.UtcNow < _expiresAt)
        {
            token = _cachedToken;
            return true;
        }

        token = string.Empty;
        return false;
    }

    /// <summary>
    /// Response body of the dev token endpoint (OAuth2-style snake_case
    /// field names).
    /// </summary>
    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
