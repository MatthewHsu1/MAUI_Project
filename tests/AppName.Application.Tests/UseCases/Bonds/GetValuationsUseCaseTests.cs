using AppName.Application.UseCases.Bonds;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.Tests.UseCases.Bonds;

public class GetValuationsUseCaseTests
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
            RefreshState.Setup(r => r.GetAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, null, null));
            Snapshots.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<BondValuationSnapshot>());
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        }

        public Fixture WithLastAttempt(DateOnly date)
        {
            RefreshState.Setup(r => r.GetAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, date, date));
            return this;
        }

        public Fixture WithSnapshots(params BondValuationSnapshot[] snaps)
        {
            Snapshots.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(snaps);
            return this;
        }

        public Fixture WithFailingRefresh()
        {
            Refresh.Setup(r => r.ExecuteAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("network down"));
            return this;
        }

        public GetValuationsUseCase Build() =>
            new(RefreshState.Object, Snapshots.Object, Refresh.Object, new FixedTimeProvider(FixedUtc));
    }

    [Fact]
    public async Task ExecuteAsync_Refreshes_WhenLastAttemptIsNotToday()
    {
        var fx = new Fixture().WithLastAttempt(new DateOnly(2026, 7, 1));

        await fx.Build().ExecuteAsync();

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ServesCache_WhenLastAttemptIsToday()
    {
        var fx = new Fixture().WithLastAttempt(TwToday);

        await fx.Build().ExecuteAsync();

        fx.Refresh.Verify(r => r.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsSnapshotsMappedToDtos()
    {
        var fx = new Fixture()
            .WithLastAttempt(TwToday)
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 2), 100_000m, true));

        var dtos = await fx.Build().ExecuteAsync();

        var dto = Assert.Single(dtos);
        Assert.Equal("11011", dto.Symbol);
        Assert.Equal(120_000m, dto.ConversionValue);
        Assert.Equal(100_000m, dto.BondPrice);
        Assert.True(dto.IsInTheMoney);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCache_WhenRefreshThrows()
    {
        var fx = new Fixture()
            .WithLastAttempt(new DateOnly(2026, 7, 1))
            .WithFailingRefresh()
            .WithSnapshots(new BondValuationSnapshot("11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 1), null, null));

        var dtos = await fx.Build().ExecuteAsync();

        var dto = Assert.Single(dtos);      // no throw; stale cache served
        Assert.Null(dto.BondPrice);
    }
}
