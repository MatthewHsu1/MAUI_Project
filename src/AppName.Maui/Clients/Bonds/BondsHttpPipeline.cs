using AppName.Maui.Clients.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui.Clients.Bonds;

/// <summary>
/// Registers the AppName.Api bond-valuation typed HTTP client.
/// </summary>
public static class BondsHttpPipeline
{
    /// <summary>
    /// Adds the typed <see cref="IBondsApiClient"/> client, authenticated with the
    /// bearer token supplied by <see cref="BearerTokenHandler"/>.
    /// </summary>
    public static IServiceCollection AddBondsHttpClient(this IServiceCollection services)
    {
        services.AddHttpClient<IBondsApiClient, BondsApiClient>(ApiClientConfiguration.Configure)
            .AddHttpMessageHandler<BearerTokenHandler>();

        return services;
    }
}
