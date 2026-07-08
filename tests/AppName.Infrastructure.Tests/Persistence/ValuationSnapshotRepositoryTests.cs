using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence;

public class ValuationSnapshotRepositoryTests
{
    private sealed class Fixture : IDisposable
    {
        private sealed class SingleContextFactory(DbContextOptions<AppDbContext> options) : IDbContextFactory<AppDbContext>
        {
            public AppDbContext CreateDbContext() => new(options);
        }

        private readonly SqliteConnection _connection;

        public ValuationSnapshotRepository Repo { get; }

        public Fixture()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options;
            using (var ctx = new AppDbContext(options))
                ctx.Database.EnsureCreated();

            Repo = new ValuationSnapshotRepository(new SingleContextFactory(options));
        }

        public void Dispose() => _connection.Dispose();
    }

    private static BondValuationSnapshot Snap(string symbol, decimal value, bool? itm) =>
        new(symbol, 2_000m, value, 60m, new DateOnly(2026, 7, 2), itm is null ? null : 100_000m, itm);

    [Fact]
    public async Task UpsertManyAsync_ThenGetAll_RoundTripsAllRows()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(new[] { Snap("11011", 120_000m, true), Snap("33033", 80_000m, false) });
        var all = await fx.Repo.GetAllAsync();

        Assert.Equal(2, all.Count);
        Assert.Contains(all, s => s.Symbol == "11011" && s.IsInTheMoney == true);
        Assert.Contains(all, s => s.Symbol == "33033" && s.IsInTheMoney == false);
    }

    [Fact]
    public async Task UpsertManyAsync_Existing_OverwritesInPlace_WithoutDuplicating()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(new[] { Snap("11011", 120_000m, true) });
        await fx.Repo.UpsertManyAsync(new[] { Snap("11011", 90_000m, false) });
        var all = await fx.Repo.GetAllAsync();

        var only = Assert.Single(all);
        Assert.Equal(90_000m, only.ConversionValue);
        Assert.False(only.IsInTheMoney);
    }

    [Fact]
    public async Task UpsertManyAsync_PreservesNullBondPrice()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(new[] { Snap("11011", 120_000m, null) });
        var only = Assert.Single(await fx.Repo.GetAllAsync());

        Assert.Null(only.BondPrice);
        Assert.Null(only.IsInTheMoney);
    }
}
