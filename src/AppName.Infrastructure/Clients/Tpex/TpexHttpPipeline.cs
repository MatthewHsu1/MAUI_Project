using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AppName.Infrastructure.Clients.Tpex;

/// <summary>
/// Registers the TPEx typed HTTP clients with resilience.
/// </summary>
public static class TpexHttpPipeline
{
    /// <summary>
    /// Adds the TPEx bond-issuance and OTC stock-quote typed HTTP clients to DI.
    /// </summary>
    public static IServiceCollection AddTpexHttpClients(this IServiceCollection services)
    {
        services.AddHttpClient<ITpexBondIssuanceApiClient, TpexBondIssuanceApiClient>(Configure)
            .AddStandardResilienceHandler();

        services.AddHttpClient<ITpexStockQuoteApiClient, TpexStockQuoteApiClient>(Configure)
            .AddStandardResilienceHandler();

        return services;
    }

    internal static void Configure(IServiceProvider sp, HttpClient client)
    {
        var o = sp.GetRequiredService<IOptions<TpexApiOptions>>().Value;

        client.BaseAddress = new Uri(o.BaseUrl.EndsWith('/') ? o.BaseUrl : o.BaseUrl + "/");
        
        client.DefaultRequestHeaders.UserAgent.ParseAdd(o.UserAgent);
    }
}
