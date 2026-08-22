using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence;

// The TryClaimAttemptAsync tests below are compare-and-set tests, not concurrency
// tests. The fixture shares one SQLite connection, so it cannot run two callers at
// once. The claim is correct because it is a single conditional UPDATE statement:
// the database, not the test, picks the winner. These tests prove the predicate.
public class BondValuationRefreshStateRepositoryTests
{
    private sealed class Fixture : IDisposable
    {
        private sealed class SingleContextFactory(DbContextOptions<AppDbContext> options) : IDbContextFactory<AppDbContext>
        {
            public AppDbContext CreateDbContext() => new(options);
        }

        private readonly SqliteConnection _connection;

        public BondValuationRefreshStateRepository Repo { get; }

        public Fixture()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options;
            // EnsureCreated applies HasData, so the seeded singleton marker row
            // exists before any test runs. TryClaimAttemptAsync needs that row,
            // because a conditional UPDATE cannot hit a table with no rows.
            using (var ctx = new AppDbContext(options))
                ctx.Database.EnsureCreated();

            Repo = new BondValuationRefreshStateRepository(new SingleContextFactory(options));
        }

        public void Dispose() => _connection.Dispose();
    }

    [Fact]
    public async Task GetAsync_ReturnsDefault_WhenNeverSet()
    {
        using var fx = new Fixture();

        var state = await fx.Repo.GetAsync();

        Assert.Equal(BondValuationRefreshState.SingletonId, state.Id);
        Assert.Null(state.LastAttemptDate);
        Assert.Null(state.LastAsOf);
    }

    [Fact]
    public async Task SetAsync_ThenGet_RoundTrips()
    {
        using var fx = new Fixture();

        await fx.Repo.SetAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 7, 2), new DateOnly(2026, 7, 2)));
        var state = await fx.Repo.GetAsync();

        Assert.Equal(new DateOnly(2026, 7, 2), state.LastAttemptDate);
        Assert.Equal(new DateOnly(2026, 7, 2), state.LastAsOf);
    }

    [Fact]
    public async Task SetAsync_Twice_UpdatesSingleRowInPlace()
    {
        using var fx = new Fixture();

        await fx.Repo.SetAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 1)));
        await fx.Repo.SetAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 7, 2), new DateOnly(2026, 7, 2)));
        var state = await fx.Repo.GetAsync();

        Assert.Equal(new DateOnly(2026, 7, 2), state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_OnFreshDatabase()
    {
        using var fx = new Fixture();

        // The seeded row has a null LastAttemptDate. This fails if the claim
        // predicate drops its "== null" arm, because SQL evaluates
        // NULL != @today as NULL and the UPDATE then matches no row.
        Assert.True(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1)));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_OnSecondClaimForSameDay()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1));

        Assert.False(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1)));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_OnNextDay()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1));

        Assert.True(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 2)));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_RecordsClaimedDay_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1));
        var state = await fx.Repo.GetAsync();

        Assert.Equal(new DateOnly(2026, 7, 1), state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_LeavesLastAsOfUnchanged_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.SetAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 6, 30), null));

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1));
        var state = await fx.Repo.GetAsync();

        // The claim marks only the attempt. LastAsOf still records the last
        // successful pull, so a losing refresh must not appear as a success.
        Assert.Equal(new DateOnly(2026, 6, 30), state.LastAsOf);
    }
}
