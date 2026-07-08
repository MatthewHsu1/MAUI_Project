using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence;

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
}
