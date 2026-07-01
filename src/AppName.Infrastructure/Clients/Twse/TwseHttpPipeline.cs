using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AppName.Infrastructure.Clients.Twse;

/// <summary>
/// Registers the TWSE typed HTTP client with resilience.
/// </summary>
public static class TwseHttpPipeline
{
    /// <summary>
    /// Adds the TWSE stock-quote typed HTTP client to DI.
    /// </summary>
    public static IServiceCollection AddTwseHttpClients(this IServiceCollection services)
    {
        services.AddHttpClient<ITwseStockQuoteApiClient, TwseStockQuoteApiClient>(Configure)
            .AddStandardResilienceHandler();

        return services;
    }

    internal static void Configure(IServiceProvider sp, HttpClient client)
    {
        var o = sp.GetRequiredService<IOptions<TwseApiOptions>>().Value;

        client.BaseAddress = new Uri(o.BaseUrl.EndsWith('/') ? o.BaseUrl : o.BaseUrl + "/");

        client.DefaultRequestHeaders.UserAgent.ParseAdd(o.UserAgent);
    }
}
