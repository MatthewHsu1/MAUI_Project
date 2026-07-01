using AppName.Domain.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure.Tests;

public class DependencyInjectionTests
{
    [Fact]
    public void AddInfrastructure_Resolves_MarketDataProvider()
    {
        var services = new ServiceCollection();
        services.AddInfrastructure(":memory:");
        using var sp = services.BuildServiceProvider();
        Assert.NotNull(sp.GetService<IMarketDataProvider>());
    }

    [Fact]
    public void AddInfrastructure_Resolves_BondRepository()
    {
        var services = new ServiceCollection();
        services.AddInfrastructure(":memory:");
        using var sp = services.BuildServiceProvider();
        Assert.NotNull(sp.GetService<IConvertibleBondRepository>());
    }
}
