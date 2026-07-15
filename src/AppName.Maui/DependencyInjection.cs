using AppName.Maui.Bridge;
using AppName.Maui.Clients;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the presentation (MAUI/UI) layer: every <see cref="IWebBridge"/>
    /// feature bridge (by assembly scan), the aggregate <see cref="AppBridge"/>
    /// invoke target, and the pages.
    /// </summary>
    public static IServiceCollection AddPresentation(this IServiceCollection services)
    {
        services.Scan(s => s.FromAssemblyOf<AppBridge>()
            .AddClasses(c => c.AssignableTo<IWebBridge>())
            .AsSelf().WithTransientLifetime());

        services.AddTransient<AppBridge>();
        services.AddTransient<MainPage>();
        return services;
    }

    /// <summary>
    /// Registers everything needed to reach AppName.Api: binds
    /// <see cref="ApiClientOptions"/> from configuration and adds the client
    /// pipelines (see <see cref="ApiClientHttpPipeline.AddApiHttpClients"/>).
    /// </summary>
    public static IServiceCollection AddApiClient(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<ApiClientOptions>()
            .Bind(configuration.GetSection(ApiClientOptions.SectionName));

        services.AddApiHttpClients();

        return services;
    }

    /// <summary>
    /// Composition root: wires everything the MAUI head needs - the API
    /// client pipeline and the presentation layer - so the host only needs a
    /// single registration call. MAUI is a thin HTTP client over
    /// AppName.Api: it does not reference AppName.Infrastructure, run
    /// use-cases, or touch a database directly.
    /// </summary>
    public static IServiceCollection AddAppServices(this IServiceCollection services, IConfiguration configuration)
        => services
            .AddApiClient(configuration)
            .AddPresentation();
}
