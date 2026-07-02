using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AppName.Infrastructure.Clients.TwseMis;

/// <summary>
/// Registers the TWSE MIS quote typed HTTP client with resilience.
/// </summary>
public static class TwseMisHttpPipeline
{
    /// <summary>
    /// Adds the TWSE MIS bond-quote typed HTTP client to DI.
    /// </summary>
    public static IServiceCollection AddTwseMisHttpClients(this IServiceCollection services)
    {
        services.AddHttpClient<ITwseMisBondQuoteApiClient, TwseMisBondQuoteApiClient>(Configure)
            .AddStandardResilienceHandler();

        return services;
    }

    internal static void Configure(IServiceProvider sp, HttpClient client)
    {
        var o = sp.GetRequiredService<IOptions<TwseMisApiOptions>>().Value;

        client.BaseAddress = new Uri(o.BaseUrl.EndsWith('/') ? o.BaseUrl : o.BaseUrl + "/");

        client.DefaultRequestHeaders.UserAgent.ParseAdd(o.UserAgent);
        client.DefaultRequestHeaders.Referrer = new Uri(o.Referer);
    }
}
