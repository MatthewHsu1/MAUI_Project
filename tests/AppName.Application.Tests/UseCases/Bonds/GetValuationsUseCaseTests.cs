using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.Extensions.Logging.Abstractions;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetValuationsUseCaseTests
{
    private static readonly DateTimeOffset FixedUtc = new(2026, 7, 2, 4, 0, 0, TimeSpan.Zero); // TW 2026-07-02
    private static readonly DateOnly TwToday = new(2026, 7, 2);

    private static readonly ValuationQuery DefaultQuery = new(
        ValuationFilter.None,
        new SortSpec<ValuationSortField>(ValuationSortField.Symbol, SortDirection.Asc, NullPlacement.Last),
        Offset: 0,
        Limit: 100);

    private sealed class Fixture
    {
        public Mock<IBondValuationRefreshStateRepository> RefreshState { get; } = new();
        public Mock<IValuationSnapshotRepository> Snapshots { get; } = new();
        public Mock<IRefreshAllBondsUseCase> Refresh { get; } = new();

        public Fixture()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            Snapshots.Setup(s => s.QueryAsync(It.IsAny<ValuationQuery>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<BondValuationSnapshot>());
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        public Fixture WithLostClaim()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            return this;
        }

        public Fixture WithSnapshots(params BondValuationSnapshot[] snaps)
        {
            Snapshots.Setup(s => s.QueryAsync(It.IsAny<ValuationQuery>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(snaps);
            return this;
        }

        public Fixture WithFailingRefresh()
        {
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("network down"));
            return this;
        }

        public GetValuationsUseCase Build() =>
            new(RefreshState.Object, Snapshots.Object, Refresh.Object, new FixedTimeProvider(FixedUtc), NullLogger<GetValuationsUseCase>.Instance);
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

        fx.RefreshState.Verify(r => r.TryClaimAttemptAsync(TwToday, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ServesCacheWithoutRefreshing_WhenClaimIsLost()
    {
        var fx = new Fixture()
            .WithLostClaim()
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 1), null, null));

        var dtos = await fx.Build().ExecuteAsync(DefaultQuery);

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
        Assert.Single(dtos);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsSnapshotsMappedToDtos()
    {
        var fx = new Fixture()
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 2), 100_000m, true));

        var dtos = await fx.Build().ExecuteAsync(DefaultQuery);

        var dto = Assert.Single(dtos);
        Assert.Equal("11011", dto.Symbol);
        Assert.Equal(2_000m, dto.ConversionShares);
        Assert.Equal(120_000m, dto.ConversionValue);
        Assert.Equal(60m, dto.StockPrice);
        Assert.Equal(new DateOnly(2026, 7, 2), dto.AsOf);
        Assert.Equal(100_000m, dto.BondPrice);
        Assert.True(dto.IsInTheMoney);
    }

    [Fact]
    public async Task ExecuteAsync_PassesQueryToRepository()
    {
        var fx = new Fixture();
        var query = new ValuationQuery(
            new ValuationFilter(Symbol: "110"),
            new SortSpec<ValuationSortField>(ValuationSortField.BondPrice, SortDirection.Desc, NullPlacement.Last),
            Offset: 200,
            Limit: 50);

        await fx.Build().ExecuteAsync(query);

        fx.Snapshots.Verify(s => s.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenRefreshThrows()
    {
        var fx = new Fixture()
            .WithFailingRefresh()
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 1), null, null));

        var dtos = await fx.Build().ExecuteAsync(DefaultQuery);

        var dto = Assert.Single(dtos);      // no throw; stale cache served
        Assert.Null(dto.BondPrice);
    }
}
