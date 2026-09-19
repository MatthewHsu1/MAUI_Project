using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Bonds;
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
    private static readonly DateOnly Today = new(2026, 7, 1);
    private static readonly DateOnly Yesterday = new(2026, 6, 30);
    private static readonly DateOnly Tomorrow = new(2026, 7, 2);

    private static readonly DateTime Now = new(2026, 7, 1, 4, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime NextAttempt = Now.AddMinutes(15);
    private static readonly DateTime RetryAt = Now.AddMinutes(5);

    private sealed class Fixture : IDisposable
    {
        private sealed class SingleContextFactory(DbContextOptions<AppDbContext> options) : IDbContextFactory<AppDbContext>
        {
            public AppDbContext CreateDbContext() => new(options);
        }

        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<AppDbContext> _options;

        public BondValuationRefreshStateRepository Repo { get; }

        public Fixture()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options;
            // EnsureCreated applies HasData, so the seeded singleton marker row
            // exists before any test runs. TryClaimAttemptAsync needs that row,
            // because a conditional UPDATE cannot hit a table with no rows.
            using (var ctx = new AppDbContext(_options))
                ctx.Database.EnsureCreated();

            Repo = new BondValuationRefreshStateRepository(new SingleContextFactory(_options));
        }

        // Writes the marker straight through a context rather than through the
        // repository, so a test that arranges state does not also exercise the
        // member it is about to assert on.
        public Fixture WithMarker(DateOnly? lastAsOf, DateOnly? lastAttemptDate, DateTime? nextAttemptNotBefore = null)
        {
            using var ctx = new AppDbContext(_options);

            var row = ctx.BondValuationRefreshStates.Single(r => r.Id == BondValuationRefreshState.SingletonId);
            row.Update(lastAsOf, lastAttemptDate, nextAttemptNotBefore);
            ctx.SaveChanges();

            return this;
        }

        public void Dispose() => _connection.Dispose();
    }

    private static BondValuationRefreshClaim Claim(
        DateOnly expectedDataDate,
        DateTime now,
        DateTime nextAttemptNotBefore,
        DateOnly? taiwanToday = null,
        bool closePublishGraceOpen = true) =>
        new()
        {
            ExpectedDataDate = expectedDataDate,
            TaiwanToday = taiwanToday ?? expectedDataDate,
            IsClosePublishGraceOpen = closePublishGraceOpen,
            Now = now,
            NextAttemptNotBefore = nextAttemptNotBefore,
        };

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

        await fx.Repo.SetAsync(new BondValuationRefreshState(
            BondValuationRefreshState.SingletonId, Tomorrow, Tomorrow));

        var state = await fx.Repo.GetAsync();
        Assert.Equal(Tomorrow, state.LastAttemptDate);
        Assert.Equal(Tomorrow, state.LastAsOf);
    }

    [Fact]
    public async Task SetAsync_Twice_UpdatesSingleRowInPlace()
    {
        using var fx = new Fixture()
            .WithMarker(Today, Today);

        await fx.Repo.SetAsync(new BondValuationRefreshState(
            BondValuationRefreshState.SingletonId, Tomorrow, Tomorrow));

        var state = await fx.Repo.GetAsync();
        Assert.Equal(Tomorrow, state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_OnFreshDatabase()
    {
        using var fx = new Fixture();

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now, NextAttempt));

        // The seeded row has a null LastAsOf. This fails if the claim predicate
        // drops its "== null" arm, because SQL evaluates NULL < @date as NULL
        // and the UPDATE then matches no row.
        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_WhenCachedDataCarriesTheExpectedDate()
    {
        using var fx = new Fixture()
            .WithMarker(Today, Today);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now, NextAttempt));

        Assert.False(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_WhenCachedDataIsOlderThanTheExpectedDate()
    {
        // The pull ran before the exchange published today's close, so it brought
        // back yesterday's prices. Gating on the attempt would serve those until
        // tomorrow; gating on the data tries again.
        using var fx = new Fixture()
            .WithMarker(Yesterday, Today);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now, NextAttempt));

        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_WhenTheDayHasAlreadyFailedToPublishAClose()
    {
        // A Taiwan holiday looks exactly like this: the day was attempted, the data
        // never reached the expected date, and the grace period has run out. Without
        // the attempt-date arm the whole market would be pulled again every interval
        // until midnight.
        using var fx = new Fixture()
            .WithMarker(Yesterday, Today);

        var won = await fx.Repo.TryClaimAttemptAsync(
            Claim(Today, Now, NextAttempt, closePublishGraceOpen: false));

        Assert.False(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_WhenTheGraceIsClosedButTheDayWasNeverAttempted()
    {
        // Opening the app late in the evening must still pick up today's close.
        using var fx = new Fixture()
            .WithMarker(Yesterday, Yesterday);

        var won = await fx.Repo.TryClaimAttemptAsync(
            Claim(Today, Now, NextAttempt, closePublishGraceOpen: false));

        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_WhenNextAttemptTimeHasNotElapsed()
    {
        using var fx = new Fixture()
            .WithMarker(null, null, NextAttempt);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now.AddMinutes(1), NextAttempt));

        // The stamp the winner left is the mutex: LastAsOf cannot move until that
        // refresh finishes, so nothing else here would keep a second caller out.
        Assert.False(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_WhenNextAttemptTimeHasElapsed()
    {
        using var fx = new Fixture()
            .WithMarker(null, null, NextAttempt);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, NextAttempt, NextAttempt.AddMinutes(15)));

        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_StampsNextAttemptTime_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now, NextAttempt));

        var state = await fx.Repo.GetAsync();
        Assert.Equal(NextAttempt, state.NextAttemptNotBefore);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_OnNextDay()
    {
        using var fx = new Fixture()
            .WithMarker(Today, Today, NextAttempt);

        var won = await fx.Repo.TryClaimAttemptAsync(
            Claim(Tomorrow, NextAttempt.AddDays(1), NextAttempt.AddDays(1)));

        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_RecordsClaimedDay_WhenClaimWins()
    {
        using var fx = new Fixture();

        await fx.Repo.TryClaimAttemptAsync(Claim(Yesterday, Now, NextAttempt, taiwanToday: Today));

        var state = await fx.Repo.GetAsync();
        Assert.Equal(Today, state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_LeavesLastAsOfUnchanged_WhenClaimWins()
    {
        using var fx = new Fixture()
            .WithMarker(Yesterday, null);

        await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now, NextAttempt));

        // The claim marks only the attempt. LastAsOf still records the last
        // successful pull, so a losing refresh must not appear as a success.
        var state = await fx.Repo.GetAsync();
        Assert.Equal(Yesterday, state.LastAsOf);
    }

    [Fact]
    public async Task SetNextAttemptAsync_AfterAClaim_RecordsTheNewTime()
    {
        using var fx = new Fixture()
            .WithMarker(null, Today, NextAttempt);

        await fx.Repo.SetNextAttemptAsync(RetryAt);

        var state = await fx.Repo.GetAsync();
        Assert.Equal(RetryAt, state.NextAttemptNotBefore);
    }

    [Fact]
    public async Task SetNextAttemptAsync_AfterAClaim_LeavesLastAttemptDateStamped()
    {
        using var fx = new Fixture()
            .WithMarker(null, Today, NextAttempt);

        await fx.Repo.SetNextAttemptAsync(RetryAt);

        var state = await fx.Repo.GetAsync();
        Assert.Equal(Today, state.LastAttemptDate);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsTrue_WhenBackoffFromAFailedAttemptHasElapsed()
    {
        using var fx = new Fixture()
            .WithMarker(null, Today, RetryAt);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now.AddMinutes(6), NextAttempt));

        // A shorter backoff replaces the claim's worst-case lease, so a failed
        // attempt is retried on its own schedule rather than the lease's.
        Assert.True(won);
    }

    [Fact]
    public async Task TryClaimAttemptAsync_ReturnsFalse_WhenBackoffFromAFailedAttemptHasNotElapsed()
    {
        using var fx = new Fixture()
            .WithMarker(null, Today, RetryAt);

        var won = await fx.Repo.TryClaimAttemptAsync(Claim(Today, Now.AddMinutes(1), NextAttempt));

        // This is the whole point of the backoff: an outage must not make every
        // read pay the upstream timeout again.
        Assert.False(won);
    }
}
