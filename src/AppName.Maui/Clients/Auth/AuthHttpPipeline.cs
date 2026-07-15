using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui.Clients.Auth;

/// <summary>
/// Registers the AppName.Api auth-token HTTP client and the pieces that use it.
/// </summary>
public static class AuthHttpPipeline
{
    /// <summary>
    /// Adds the unauthenticated dev-token named client, the token provider that
    /// calls it, and the <see cref="BearerTokenHandler"/> other client pipelines
    /// attach to authenticate their requests.
    /// </summary>
    public static IServiceCollection AddAuthHttpClient(this IServiceCollection services)
    {
        // Unauthenticated - used only to fetch the dev bearer token itself, so it
        // must NOT go through BearerTokenHandler (that would recurse).
        services.AddHttpClient(DevAuthTokenProvider.AuthClientName, ApiClientConfiguration.Configure);

        services.AddSingleton<IAuthTokenProvider, DevAuthTokenProvider>();

        services.AddTransient<BearerTokenHandler>();

        return services;
    }
}
