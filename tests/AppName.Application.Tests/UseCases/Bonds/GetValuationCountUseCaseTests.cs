using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.Extensions.Logging.Abstractions;

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
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            Snapshots.Setup(s => s.CountAsync(It.IsAny<ValuationFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(0);
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        public Fixture WithLostClaim()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<DateOnly>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
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

        public Fixture WithCancelledRefresh()
        {
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new OperationCanceledException());
            return this;
        }

        public Fixture WithFailingRelease()
        {
            RefreshState.Setup(r => r.ReleaseClaimAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("database down"));
            return this;
        }

        public GetValuationCountUseCase Build() =>
            new(RefreshState.Object, Snapshots.Object, Refresh.Object, new FixedTimeProvider(FixedUtc), NullLogger<GetValuationCountUseCase>.Instance);
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

        fx.RefreshState.Verify(r => r.TryClaimAttemptAsync(TwToday, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
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

    // The four tests below cover DailyRefreshGate's release path. They go through
    // this use case rather than the gate directly, because the gate is internal
    // and reached through the use cases by design — see its class remarks.

    [Fact]
    public async Task ExecuteAsync_ReleasesClaimAfterBackoff_WhenRefreshThrows()
    {
        var fx = new Fixture().WithFailingRefresh();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        // Five minutes is DailyRefreshGate.RetryBackoff, spelled out because the
        // constant is internal to the Application project. Without the release,
        // one upstream failure would consume the whole trading day.
        fx.RefreshState.Verify(
            r => r.ReleaseClaimAsync(FixedUtc.UtcDateTime.AddMinutes(5), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ReleasesClaimImmediately_WhenRefreshIsCancelled()
    {
        var fx = new Fixture().WithCancelledRefresh();

        // Cancellation still propagates; only the claim is given back.
        await Assert.ThrowsAsync<OperationCanceledException>(
            () => fx.Build().ExecuteAsync(ValuationFilter.None));

        // No backoff: a caller walking away is not an upstream fault, so the next
        // reader should try at once.
        fx.RefreshState.Verify(
            r => r.ReleaseClaimAsync(FixedUtc.UtcDateTime, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_KeepsClaim_WhenRefreshSucceeds()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        fx.RefreshState.Verify(
            r => r.ReleaseClaimAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenReleasingTheClaimAlsoThrows()
    {
        var fx = new Fixture().WithFailingRefresh().WithFailingRelease().WithCount(412);

        // The release runs on the failure path of a best-effort refresh, so it
        // must not become the thing that fails the caller.
        Assert.Equal(412, await fx.Build().ExecuteAsync(ValuationFilter.None));
    }
}
