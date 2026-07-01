using AppName.Domain.Abstractions;
using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Twse;
using AppName.Infrastructure.Gateways;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string dbPath)
    {
        services.AddDbContextFactory<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));

        services.AddOptions<TpexApiOptions>();
        services.AddOptions<TwseApiOptions>();
        services.AddTpexHttpClients();
        services.AddTwseHttpClients();

        services.AddScoped<IMarketDataProvider, MarketDataProvider>();
        services.AddScoped<IConvertibleBondRepository, ConvertibleBondRepository>();
        return services;
    }
}
