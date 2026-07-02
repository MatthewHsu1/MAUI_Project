using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence;

public class MigrationTests
{
    private sealed class Fixture : IDisposable
    {
        private readonly SqliteConnection _conn;

        public AppDbContext Db { get; }

        public Fixture()
        {
            _conn = new SqliteConnection("Data Source=:memory:");
            _conn.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
            Db = new AppDbContext(options);
            Db.Database.Migrate();
        }

        public void Dispose()
        {
            Db.Dispose();
            _conn.Dispose();
        }
    }

    [Fact]
    public void Migrate_CreatesConvertibleBondsSchema_AndRoundTripsABond()
    {
        using var fx = new Fixture();

        fx.Db.ConvertibleBonds.Add(new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101"));
        fx.Db.SaveChanges();

        Assert.Equal(36.5m, fx.Db.ConvertibleBonds.Single().ConversionPrice);
    }

    [Fact]
    public void Migrate_CreatesSnapshotAndBondValuationRefreshStateSchema_AndRoundTrips()
    {
        using var fx = new Fixture();

        fx.Db.BondValuationSnapshots.Add(new BondValuationSnapshot(
            "11011", 2_000m, 120_000m, 60m, new DateOnly(2026, 7, 2), 100_000m, true));
        fx.Db.BondValuationRefreshStates.Add(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, new DateOnly(2026, 7, 2), new DateOnly(2026, 7, 2)));
        fx.Db.SaveChanges();

        var snap = fx.Db.BondValuationSnapshots.Single();
        Assert.Equal(120_000m, snap.ConversionValue);
        Assert.True(snap.IsInTheMoney);

        var state = fx.Db.BondValuationRefreshStates.Single();
        Assert.Equal(new DateOnly(2026, 7, 2), state.LastAttemptDate);
    }
}
