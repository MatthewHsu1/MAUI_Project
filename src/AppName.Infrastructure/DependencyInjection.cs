using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;
using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Twse;
using AppName.Infrastructure.Clients.TwseMis;
using AppName.Infrastructure.Gateways;
using AppName.Infrastructure.Persistence.Bonds;
using AppName.Infrastructure.Persistence.Context;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(SecretKeysConstants.ConnectionStrings.AppDb);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'ConnectionStrings:{SecretKeysConstants.ConnectionStrings.AppDb}' is not configured. " +
                "Set it in appsettings.{Environment}.json, user-secrets, or the " +
                $"ConnectionStrings__{SecretKeysConstants.ConnectionStrings.AppDb} environment variable.");
        }

        connectionString = NpgsqlConnectionString.ResolveRootCertificate(connectionString);

        services.AddDbContextFactory<AppDbContext>(options =>
            options
                .UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure())
                .ReplaceService<IHistoryRepository, YugabyteHistoryRepository>());

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
