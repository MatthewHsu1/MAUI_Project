using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetValuationCountUseCaseTests
{
    private static readonly DateTimeOffset FixedUtc = new(2026, 7, 2, 4, 0, 0, TimeSpan.Zero); // TW 2026-07-02
    private static readonly DateOnly TwToday = new(2026, 7, 2);

    private sealed class Fixture
    {
        public Mock<IBondValuationRefreshStateRepository> RefreshState { get; } = new();
        public Mock<IValuationSnapshotRepository> Snapshots { get; } = new();
        public Mock<IRefreshAllBondsUseCase> Refresh { get; } = new();

        public Fixture()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
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

        public GetValuationCountUseCase Build() =>
            new(RefreshState.Object, Snapshots.Object, Refresh.Object, new FixedTimeProvider(FixedUtc));
    }

    [Fact]
    public async Task ExecuteAsync_RefreshesOnce_WhenClaimIsWon()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ClaimsTaiwanToday()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        fx.RefreshState.Verify(r => r.TryClaimAttemptAsync(TwToday, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ServesCacheWithoutRefreshing_WhenClaimIsLost()
    {
        var fx = new Fixture().WithLostClaim().WithCount(412);

        var count = await fx.Build().ExecuteAsync(ValuationFilter.None);

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal(412, count);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsRepositoryCount()
    {
        var fx = new Fixture().WithCount(7);

        Assert.Equal(7, await fx.Build().ExecuteAsync(ValuationFilter.None));
    }

    [Fact]
    public async Task ExecuteAsync_PassesFilterToRepository()
    {
        var fx = new Fixture();
        var filter = new ValuationFilter(Symbol: "110", InTheMoney: true);

        await fx.Build().ExecuteAsync(filter);

        fx.Snapshots.Verify(s => s.CountAsync(filter, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenRefreshThrows()
    {
        var fx = new Fixture().WithFailingRefresh().WithCount(412);

        var count = await fx.Build().ExecuteAsync(ValuationFilter.None);

        Assert.Equal(412, count);   // no throw; stale cache counted
    }
}
