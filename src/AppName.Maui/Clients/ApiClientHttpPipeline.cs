using AppName.Maui.Clients.Auth;
using AppName.Maui.Clients.Bonds;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui.Clients;

/// <summary>
/// Registers every HTTP client the MAUI head uses to reach AppName.Api, by
/// delegating to each feature's own pipeline.
/// </summary>
public static class ApiClientHttpPipeline
{
    /// <summary>
    /// Adds the auth and bonds client pipelines. Auth is registered first
    /// because the bonds pipeline attaches its <see cref="BearerTokenHandler"/>.
    /// </summary>
    public static IServiceCollection AddApiHttpClients(this IServiceCollection services)
        => services
            .AddAuthHttpClient()
            .AddBondsHttpClient();
}
