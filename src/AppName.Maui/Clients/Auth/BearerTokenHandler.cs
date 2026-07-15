using System.Net.Http.Headers;

namespace AppName.Maui.Clients.Auth;

/// <summary>
/// Attaches a bearer token obtained from <see cref="IAuthTokenProvider"/> to
/// every outgoing request on the pipeline it is added to.
/// </summary>
public sealed class BearerTokenHandler(IAuthTokenProvider tokenProvider) : DelegatingHandler
{
    /// <summary>
    /// Fetches (or reuses the cached) bearer token and sets it on the
    /// request's <c>Authorization</c> header before continuing the pipeline.
    /// </summary>
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var token = await tokenProvider.GetTokenAsync(ct);

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return await base.SendAsync(request, ct);
    }
}
