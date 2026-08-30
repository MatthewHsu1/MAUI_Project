using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.Entities.Quotes;

namespace AppName.Application.Tests.UseCases.Bonds;

public class RefreshAllBondsUseCaseTests
{
    // TW is UTC+8, so 04:00Z on 2026-07-02 is 12:00 in Taipei on 2026-07-02.
    private static readonly DateTimeOffset FixedUtc = new(2026, 7, 2, 4, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly TwToday = new(2026, 7, 2);
    private static readonly DateOnly QuoteDate = new(2026, 6, 30);

    private sealed class Fixture
    {
        public Mock<IMarketDataProvider> Provider { get; } = new();
        public Mock<IConvertibleBondRepository> Bonds { get; } = new();
        public Mock<IValuationSnapshotRepository> Snapshots { get; } = new();
        public Mock<IBondValuationRefreshStateRepository> RefreshState { get; } = new();

        public List<BondValuationSnapshot> Saved { get; } = new();
        public BondValuationRefreshState? SavedState { get; private set; }

        public Fixture()
        {
            Provider.Setup(p => p.GetAllIssuanceTermsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<ConvertibleBond>());
            Provider.Setup(p => p.GetBondQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Dictionary<string, BondQuote>());
            Provider.Setup(p => p.GetStockQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Dictionary<string, StockQuote>());
            Snapshots.Setup(s => s.UpsertManyAsync(It.IsAny<IEnumerable<BondValuationSnapshot>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<BondValuationSnapshot>, CancellationToken>((s, _) => Saved.AddRange(s))
                .Returns(Task.CompletedTask);
            RefreshState.Setup(r => r.SetAsync(It.IsAny<BondValuationRefreshState>(), It.IsAny<CancellationToken>()))
                .Callback<BondValuationRefreshState, CancellationToken>((s, _) => SavedState = s)
                .Returns(Task.CompletedTask);
        }

        public Fixture WithBonds(params ConvertibleBond[] bonds)
        {
            Provider.Setup(p => p.GetAllIssuanceTermsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(bonds);
            return this;
        }

        public Fixture WithStockQuotes(params StockQuote[] quotes)
        {
            Provider.Setup(p => p.GetStockQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(quotes.ToDictionary(q => q.StockSymbol));
            return this;
        }

        public Fixture WithBondQuotes(params BondQuote[] quotes)
        {
            Provider.Setup(p => p.GetBondQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(quotes.ToDictionary(q => q.BondSymbol));
            return this;
        }

        public RefreshAllBondsUseCase Build() =>
            new(Provider.Object, Bonds.Object, Snapshots.Object, RefreshState.Object, new FixedTimeProvider(FixedUtc));
    }

    [Fact]
    public async Task ExecuteAsync_UpsertsTermsForEveryDiscoveredBond()
    {
        var fx = new Fixture().WithBonds(
            new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101"),
            new ConvertibleBond("33033", "某三", 100_000m, 50m, "3303"));

        await fx.Build().ExecuteAsync();

        fx.Bonds.Verify(r => r.UpsertAsync(It.Is<ConvertibleBond>(b => b.Symbol == "11011"), It.IsAny<CancellationToken>()), Times.Once);
        fx.Bonds.Verify(r => r.UpsertAsync(It.Is<ConvertibleBond>(b => b.Symbol == "33033"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ComputesSnapshot_WithInTheMoneyFlag()
    {
        var fx = new Fixture()
            .WithBonds(new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101"))
            .WithStockQuotes(new StockQuote("1101", 60m, QuoteDate))
            .WithBondQuotes(new BondQuote("11011", 100_000m, QuoteDate));

        await fx.Build().ExecuteAsync();

        var snap = Assert.Single(fx.Saved);
        Assert.Equal("11011", snap.Symbol);
        Assert.Equal(2_000m, snap.ConversionShares);
        Assert.Equal(120_000m, snap.ConversionValue);   // 2000 * 60
        Assert.Equal(100_000m, snap.BondPrice);
        Assert.True(snap.IsInTheMoney);                  // 120,000 > 100,000
    }

    [Fact]
    public async Task ExecuteAsync_LeavesBondPriceNull_WhenNoBondQuote()
    {
        var fx = new Fixture()
            .WithBonds(new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101"))
            .WithStockQuotes(new StockQuote("1101", 60m, QuoteDate));
        // no bond quote

        await fx.Build().ExecuteAsync();

        var snap = Assert.Single(fx.Saved);
        Assert.Null(snap.BondPrice);
        Assert.Null(snap.IsInTheMoney);
    }

    [Fact]
    public async Task ExecuteAsync_SkipsBond_WhenNoStockQuote()
    {
        var fx = new Fixture()
            .WithBonds(new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101"));
        // no stock quote for 1101

        await fx.Build().ExecuteAsync();

        Assert.Empty(fx.Saved);
    }

    [Fact]
    public async Task ExecuteAsync_StampsRefreshState_WithTwTodayAndMaxAsOf()
    {
        var fx = new Fixture()
            .WithBonds(new ConvertibleBond("11011", "台泥一永", 100_000m, 50m, "1101"))
            .WithStockQuotes(new StockQuote("1101", 60m, QuoteDate));

        await fx.Build().ExecuteAsync();

        Assert.NotNull(fx.SavedState);
        Assert.Equal(TwToday, fx.SavedState!.LastAttemptDate);
        Assert.Equal(QuoteDate, fx.SavedState.LastAsOf);
    }
}
