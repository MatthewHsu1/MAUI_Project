using AppName.Application;
using AppName.Infrastructure;
using AppName.Maui.Bridge;
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
    /// Composition root: wires every layer (application, infrastructure,
    /// presentation) so the host only needs a single registration call.
    /// </summary>
    public static IServiceCollection AddAppServices(this IServiceCollection services, string dbPath)
        => services
            .AddApplication()
            .AddInfrastructure(dbPath)
            .AddPresentation();
}
