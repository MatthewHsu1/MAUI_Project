using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AppName.Maui.Clients;

/// <summary>
/// Shared <see cref="HttpClient"/> configuration for every client that talks to
/// AppName.Api. Unlike the upstream-provider clients in AppName.Infrastructure -
/// which each target a different host and so carry their own options - the auth
/// and bonds clients here address the same host, so they share one base address.
/// </summary>
internal static class ApiClientConfiguration
{
    /// <summary>
    /// Applies the configured AppName.Api base address to <paramref name="client"/>.
    /// </summary>
    internal static void Configure(IServiceProvider sp, HttpClient client)
    {
        var o = sp.GetRequiredService<IOptions<ApiClientOptions>>().Value;

        if (string.IsNullOrWhiteSpace(o.BaseUrl))
        {
            throw new InvalidOperationException(
                $"{ApiClientOptions.SectionName}:{nameof(ApiClientOptions.BaseUrl)} is not configured. " +
                "Set it in appsettings.Development.json.");
        }

        var baseUrl = o.BaseUrl.EndsWith('/') ? o.BaseUrl : o.BaseUrl + "/";

#if ANDROID
        // The Android emulator runs in its own virtual network and cannot reach the
        // host machine via localhost (that resolves to the emulator itself); it must
        // use the emulator's special host-loopback alias 10.0.2.2 instead.
        baseUrl = baseUrl.Replace("localhost", "10.0.2.2");
#endif

        client.BaseAddress = new Uri(baseUrl);
    }
}
