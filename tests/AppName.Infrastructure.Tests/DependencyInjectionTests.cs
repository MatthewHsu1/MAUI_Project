using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure.Tests;

public class DependencyInjectionTests
{
    private static IConfiguration Configuration(string connectionString) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"ConnectionStrings:{SecretKeysConstants.ConnectionStrings.AppDb}"] = connectionString,
            })
            .Build();

    [Fact]
    public void AddInfrastructure_Resolves_MarketDataProvider()
    {
        var services = new ServiceCollection();
        services.AddInfrastructure(Configuration("Host=localhost;Database=test"));
        using var sp = services.BuildServiceProvider();
        Assert.NotNull(sp.GetService<IMarketDataProvider>());
    }

    [Fact]
    public void AddInfrastructure_Resolves_BondRepository()
    {
        var services = new ServiceCollection();
        services.AddInfrastructure(Configuration("Host=localhost;Database=test"));
        using var sp = services.BuildServiceProvider();
        Assert.NotNull(sp.GetService<IConvertibleBondRepository>());
    }

    [Fact]
    public void AddInfrastructure_Throws_WhenConnectionStringMissing()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => services.AddInfrastructure(configuration));
    }
}
