using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetConversionValuationUseCaseTests
{
    private sealed class Fixture
    {
        public Mock<IConvertibleBondRepository> Repo { get; } = new();
        
        public Mock<IMarketDataProvider> Provider { get; } = new();

        public GetConversionValuationUseCase Build() => new(Repo.Object, Provider.Object);

        public Fixture WithCachedBond(ConvertibleBond bond)
        {
            Repo.Setup(r => r.GetBySymbolAsync(bond.Symbol, It.IsAny<CancellationToken>()))
                .ReturnsAsync(bond);
            return this;
        }

        public Fixture WithStockQuote(StockQuote quote)
        {
            Provider.Setup(p => p.GetStockQuoteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(quote);
            return this;
        }
    }

    [Fact]
    public async Task ExecuteAsync_ComputesValuation_AndLeavesBondPriceNull()
    {
        var bond = new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101");
        var fx = new Fixture()
            .WithCachedBond(bond)
            .WithStockQuote(new StockQuote("1101", 60m, new DateOnly(2026, 6, 29)));

        var dto = await fx.Build().ExecuteAsync("11011");

        Assert.NotNull(dto);
        Assert.Equal(2_000m, dto!.ConversionShares);
        Assert.Equal(120_000m, dto.ConversionValue);
        Assert.Equal(60m, dto.StockPrice);
        Assert.Null(dto.BondPrice);
        Assert.Null(dto.IsInTheMoney);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsNull_WhenBondNotCached()
    {
        var fx = new Fixture();

        var dto = await fx.Build().ExecuteAsync("9999");

        Assert.Null(dto);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsNull_WhenNoStockQuote()
    {
        var bond = new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101");
        var fx = new Fixture()
            .WithCachedBond(bond);

        var dto = await fx.Build().ExecuteAsync("11011");

        Assert.Null(dto);
    }
}
