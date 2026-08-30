using AppName.Domain.Entities.Bonds;
using AppName.Infrastructure.Persistence.Bonds;
using AppName.Infrastructure.Persistence.Context;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence.Bonds;

// The TryClaimAttemptAsync tests below are compare-and-set tests, not concurrency
// tests. The fixture shares one SQLite connection, so it cannot run two callers at
// once. The claim is correct because it is a single conditional UPDATE statement:
// the database, not the test, picks the winner. These tests prove the predicate.
public class BondValuationRefreshStateRepositoryTests
{
    private static readonly DateTime Now = new(2026, 7, 1, 4, 0, 0, DateTimeKind.Utc);

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
        Assert.True(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_OnSecondClaimForSameDay()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);

        Assert.False(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_OnNextDay()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);

        Assert.True(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 2), Now));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_RecordsClaimedDay_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        var state = await fx.Repo.GetAsync();

        Assert.Equal(new DateOnly(2026, 7, 1), state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_LeavesLastAsOfUnchanged_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.SetAsync(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 6, 30), null));

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        var state = await fx.Repo.GetAsync();

        // The claim marks only the attempt. LastAsOf still records the last
        // successful pull, so a losing refresh must not appear as a success.
        Assert.Equal(new DateOnly(2026, 6, 30), state.LastAsOf);
    }

    [Fact]
    public async Task ReleaseClaimAsync_RecordsRetryNotBefore()
    {
        using var fx = new Fixture();
        var retryAt = Now.AddMinutes(5);

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        await fx.Repo.ReleaseClaimAsync(retryAt);
        var state = await fx.Repo.GetAsync();

        Assert.Equal(retryAt, state.RetryNotBefore);
    }

    [Fact]
    public async Task ReleaseClaimAsync_LeavesLastAttemptDateStamped()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        await fx.Repo.ReleaseClaimAsync(Now.AddMinutes(5));
        var state = await fx.Repo.GetAsync();

        // RetryNotBefore alone reopens the claim. The attempt date still records
        // that an attempt was made today.
        Assert.Equal(new DateOnly(2026, 7, 1), state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_WhenReleasedButBackoffHasNotElapsed()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        await fx.Repo.ReleaseClaimAsync(Now.AddMinutes(5));

        // This is the whole point of the backoff: an outage must not make every
        // read pay the upstream timeout again.
        Assert.False(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now.AddMinutes(1)));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_WhenReleasedAndBackoffHasElapsed()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        await fx.Repo.ReleaseClaimAsync(Now.AddMinutes(5));

        // Same day, already claimed once -- the retry is what reopens it.
        Assert.True(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now.AddMinutes(6)));
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ClearsRetryNotBefore_WhenRetryIsWon()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now);
        await fx.Repo.ReleaseClaimAsync(Now.AddMinutes(5));
        await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now.AddMinutes(6));

        // Clearing it in the same statement is what stops a second caller also
        // taking the retry.
        Assert.Null((await fx.Repo.GetAsync()).RetryNotBefore);
        Assert.False(await fx.Repo.TryClaimAttemptAsync(new DateOnly(2026, 7, 1), Now.AddMinutes(6)));
    }
}
