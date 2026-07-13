using AppName.Maui.Bridge;
using AppName.Maui.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui;

public static class DependencyInjection
{
    /// <summary>
    /// Base address of AppName.Api, the server the MAUI head talks to for
    /// every piece of data. Local-dev default only - not real per-platform
    /// configuration.
    /// </summary>
    /// <remarks>
    /// The Android emulator runs in its own virtual network and cannot reach
    /// the host machine via <c>localhost</c> (that resolves to the emulator
    /// itself); it must use the emulator's special host-loopback alias
    /// <c>10.0.2.2</c> instead. iOS simulators, Windows, and MacCatalyst can
    /// all reach the host via <c>localhost</c> directly. This should be
    /// replaced by proper per-environment configuration before this ships
    /// beyond a developer's own machine.
    /// </remarks>
    private static readonly string ApiBaseUrl =
#if ANDROID
        "http://10.0.2.2:5000/api/";
#else
        "http://localhost:5000/api/";
#endif

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
    /// Registers the HTTP client(s) used to reach AppName.Api: an
    /// unauthenticated named client for the local-dev token stub, the
    /// bearer-token delegating handler that uses it, and the typed
    /// <see cref="IBondsApiClient"/> pipeline that attaches it.
    /// </summary>
    public static IServiceCollection AddApiClient(this IServiceCollection services)
    {
        // Unauthenticated - used only to fetch the dev bearer token itself,
        // so it must not go through BearerTokenHandler (that would recurse).
        services.AddHttpClient(DevAuthTokenProvider.AuthClientName, client =>
            client.BaseAddress = new Uri(ApiBaseUrl));

        services.AddSingleton<IAuthTokenProvider, DevAuthTokenProvider>();
        services.AddTransient<BearerTokenHandler>();

        services.AddHttpClient<IBondsApiClient, BondsApiClient>(client =>
                client.BaseAddress = new Uri(ApiBaseUrl))
            .AddHttpMessageHandler<BearerTokenHandler>();

        return services;
    }

    /// <summary>
    /// Composition root: wires everything the MAUI head needs - the API
    /// client pipeline and the presentation layer - so the host only needs a
    /// single registration call. MAUI is a thin HTTP client over
    /// AppName.Api: it does not reference AppName.Infrastructure, run
    /// use-cases, or touch a database directly.
    /// </summary>
    public static IServiceCollection AddAppServices(this IServiceCollection services)
        => services
            .AddApiClient()
            .AddPresentation();
}
