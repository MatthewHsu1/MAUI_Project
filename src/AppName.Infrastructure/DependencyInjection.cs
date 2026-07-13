using AppName.Domain.Abstractions;
using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Twse;
using AppName.Infrastructure.Clients.TwseMis;
using AppName.Infrastructure.Gateways;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        connectionString = NpgsqlConnectionString.ResolveRootCertificate(connectionString);

        services.AddDbContextFactory<AppDbContext>(options => options.UseNpgsql(connectionString));

        services.AddOptions<TpexApiOptions>();
        services.AddOptions<TwseApiOptions>();
        services.AddOptions<TwseMisApiOptions>();
        services.AddTpexHttpClients();
        services.AddTwseHttpClients();
        services.AddTwseMisHttpClients();

        services.AddScoped<IMarketDataProvider, MarketDataProvider>();
        services.AddScoped<IConvertibleBondRepository, ConvertibleBondRepository>();
        services.AddScoped<IValuationSnapshotRepository, ValuationSnapshotRepository>();
        services.AddScoped<IBondValuationRefreshStateRepository, BondValuationRefreshStateRepository>();
        return services;
    }
}
