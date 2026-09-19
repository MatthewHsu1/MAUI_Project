using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.ValueObjects.Bonds;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.Extensions.Logging.Abstractions;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetValuationCountUseCaseTests
{
    private static readonly DateTimeOffset FixedUtc = new(2026, 7, 2, 4, 0, 0, TimeSpan.Zero); // TW 2026-07-02 12:00
    private static readonly DateOnly TwToday = new(2026, 7, 2);

    // Noon in Taipei is before the exchange publishes, so the newest data that can
    // exist is the previous trading day's.
    private static readonly DateOnly TwExpectedDataDate = new(2026, 7, 1);

    // DailyRefreshGate's own constants are internal to the Application project, so
    // they are restated here rather than referenced.
    private static readonly TimeSpan RetryBackoff = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan StalePollInterval = TimeSpan.FromMinutes(15);

    private sealed class Fixture
    {
        public Mock<IBondValuationRefreshStateRepository> RefreshState { get; } = new();
        public Mock<IValuationSnapshotRepository> Snapshots { get; } = new();
        public Mock<IRefreshAllBondsUseCase> Refresh { get; } = new();

        public Fixture()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<BondValuationRefreshClaim>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            Snapshots.Setup(s => s.CountAsync(It.IsAny<ValuationFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(0);
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        public Fixture WithLostClaim()
        {
            RefreshState.Setup(r => r.TryClaimAttemptAsync(It.IsAny<BondValuationRefreshClaim>(), It.IsAny<CancellationToken>()))
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

        public Fixture WithFailingNextAttemptWrite()
        {
            RefreshState.Setup(r => r.SetNextAttemptAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
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

        fx.RefreshState.Verify(
            r => r.TryClaimAttemptAsync(
                It.Is<BondValuationRefreshClaim>(c => c.TaiwanToday == TwToday), It.IsAny<CancellationToken>()),
            Times.Once);
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

    // The five tests below cover how DailyRefreshGate paces the next attempt. They
    // go through this use case rather than the gate directly, because the gate is
    // internal and reached through the use cases by design.

    [Fact]
    public async Task ExecuteAsync_SchedulesNextAttemptAfterBackoff_WhenRefreshThrows()
    {
        var fx = new Fixture().WithFailingRefresh();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        // The backoff replaces the claim's longer lease, so an upstream blip is
        // retried sooner than a market that simply has nothing newer to give.
        fx.RefreshState.Verify(
            r => r.SetNextAttemptAsync(FixedUtc.UtcDateTime + RetryBackoff, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_SchedulesNextAttemptImmediately_WhenRefreshIsCancelled()
    {
        var fx = new Fixture().WithCancelledRefresh();

        // Cancellation still propagates; only the next-attempt time is moved up.
        await Assert.ThrowsAsync<OperationCanceledException>(
            () => fx.Build().ExecuteAsync(ValuationFilter.None));

        // No backoff: a caller walking away is not an upstream fault, and nothing
        // was refreshed, so the next reader should try at once.
        fx.RefreshState.Verify(
            r => r.SetNextAttemptAsync(FixedUtc.UtcDateTime, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_LeasesTheClaim_ForThePollInterval()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        // The lease shuts the gate behind the winner. Nothing else can: the data
        // date the claim tests against cannot move until this refresh finishes.
        fx.RefreshState.Verify(
            r => r.TryClaimAttemptAsync(
                It.Is<BondValuationRefreshClaim>(c =>
                    c.ExpectedDataDate == TwExpectedDataDate
                    && c.Now == FixedUtc.UtcDateTime
                    && c.NextAttemptNotBefore == FixedUtc.UtcDateTime + StalePollInterval),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_SchedulesNextAttemptAfterPollInterval_WhenRefreshSucceeds()
    {
        var fx = new Fixture();

        await fx.Build().ExecuteAsync(ValuationFilter.None);

        // A successful pull rewrites the marker row, so without this the next read
        // would refresh again at once whenever the pull came back stale.
        fx.RefreshState.Verify(
            r => r.SetNextAttemptAsync(FixedUtc.UtcDateTime + StalePollInterval, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenSchedulingTheNextAttemptAlsoThrows()
    {
        var fx = new Fixture().WithFailingRefresh().WithFailingNextAttemptWrite().WithCount(412);

        // This write runs on the failure path of a best-effort refresh, so it must
        // not become the thing that fails the caller.
        Assert.Equal(412, await fx.Build().ExecuteAsync(ValuationFilter.None));
    }
}
