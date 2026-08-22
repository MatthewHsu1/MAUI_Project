using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetValuationPageUseCaseTests
{
    private static readonly DateTimeOffset FixedUtc = new(2026, 7, 2, 4, 0, 0, TimeSpan.Zero); // TW 2026-07-02
    private static readonly DateOnly TwToday = new(2026, 7, 2);

    private static ValuationQuery QueryFor(ValuationFilter filter) => new(
        filter,
        new SortSpec<ValuationSortField>(ValuationSortField.ConversionValue, SortDirection.Desc, NullPlacement.Last),
        Offset: 0,
        Limit: 100);

    private static readonly ValuationQuery DefaultQuery = QueryFor(ValuationFilter.None);

    private sealed class Fixture
    {
        public Mock<IBondValuationRefreshStateRepository> RefreshState { get; } = new();
        public Mock<IValuationSnapshotRepository> Snapshots { get; } = new();
        public Mock<IRefreshAllBondsUseCase> Refresh { get; } = new();

        public Fixture()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            Snapshots.Setup(s => s.QueryAsync(It.IsAny<ValuationQuery>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<BondValuationSnapshot>());
            Snapshots.Setup(s => s.CountAsync(It.IsAny<ValuationFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(0);
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        public Fixture WithLostClaim()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            return this;
        }

        public Fixture WithSnapshots(params BondValuationSnapshot[] snaps)
        {
            Snapshots.Setup(s => s.QueryAsync(It.IsAny<ValuationQuery>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(snaps);
            return this;
        }

        public Fixture WithCount(int count)
        {
            Snapshots.Setup(s => s.CountAsync(It.IsAny<ValuationFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(count);
            return this;
        }

        public Fixture WithFailingRefresh()
        {
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("network down"));
            return this;
        }

        public GetValuationPageUseCase Build() =>
            new(RefreshState.Object, Snapshots.Object, Refresh.Object, new FixedTimeProvider(FixedUtc));
    }

    [Fact]
    public async Task ExecuteAsync_RefreshesOnce_WhenClaimIsWon()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(DefaultQuery);

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ClaimsTaiwanToday()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(DefaultQuery);

        fx.RefreshState.Verify(r => r.TryClaimAttemptAsync(TwToday, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ServesCacheWithoutRefreshing_WhenClaimIsLost()
    {
        var fx = new Fixture()
            .WithLostClaim()
            .WithCount(412)
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 1), null, null));

        var page = await fx.Build().ExecuteAsync(DefaultQuery);

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
        Assert.Single(page.Items);
        Assert.Equal(412, page.Total);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsItemsFromQueryAndTotalFromCount()
    {
        var fx = new Fixture()
            .WithCount(412)
            .WithSnapshots(
                new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 2), 100_000m, true),
                new BondValuationSnapshot("11012", 1_000m, 50_000m, 50m, new DateOnly(2026, 7, 2), null, null));

        var page = await fx.Build().ExecuteAsync(DefaultQuery);

        Assert.Equal(412, page.Total);       // the filtered total, not the window size
        Assert.Equal(2, page.Items.Count);
        Assert.Equal("11011", page.Items[0].Symbol);
        Assert.Equal("11012", page.Items[1].Symbol);
        Assert.Equal(120_000m, page.Items[0].ConversionValue);
        Assert.Null(page.Items[1].BondPrice);
    }

    [Fact]
    public async Task ExecuteAsync_CountsTheFilterAlone_NotTheWholeQuery()
    {
        var fx = new Fixture();
        var filter = new ValuationFilter(Symbol: "110", MinConversionValue: 100_000m);
        var query = QueryFor(filter) with { Offset = 200, Limit = 50 };

        await fx.Build().ExecuteAsync(query);

        fx.Snapshots.Verify(s => s.CountAsync(filter, It.IsAny<CancellationToken>()), Times.Once);
        fx.Snapshots.Verify(s => s.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenRefreshThrows()
    {
        var fx = new Fixture()
            .WithFailingRefresh()
            .WithCount(1)
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 1), null, null));

        var page = await fx.Build().ExecuteAsync(DefaultQuery);

        Assert.Single(page.Items);          // no throw; stale cache served
        Assert.Equal(1, page.Total);
    }
}
