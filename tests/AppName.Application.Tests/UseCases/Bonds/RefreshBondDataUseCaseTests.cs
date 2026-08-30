using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;
using AppName.Domain.Entities.Bonds;

namespace AppName.Application.Tests.UseCases.Bonds;

public class RefreshBondDataUseCaseTests
{
    private sealed class Fixture
    {
        public Mock<IMarketDataProvider> Provider { get; } = new();
        
        public Mock<IConvertibleBondRepository> Repo { get; } = new();

        public RefreshBondDataUseCase Build() => new(Provider.Object, Repo.Object);

        public Fixture WithIssuanceTerms(ConvertibleBond terms)
        {
            Provider.Setup(p => p.GetIssuanceTermsAsync(terms.Symbol, It.IsAny<CancellationToken>()))
                .ReturnsAsync(terms);
            return this;
        }
    }

    [Fact]
    public async Task ExecuteAsync_UpsertsTermsFromProvider()
    {
        var terms = new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101");
        var fx = new Fixture()
            .WithIssuanceTerms(terms);

        await fx.Build().ExecuteAsync("11011");

        fx.Repo.Verify(r => r.UpsertAsync(It.Is<ConvertibleBond>(b => b.Symbol == "11011"), It.IsAny<CancellationToken>()), Times.Once);
    }
}
