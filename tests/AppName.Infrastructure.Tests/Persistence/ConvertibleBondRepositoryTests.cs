using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests.Persistence;

public class ConvertibleBondRepositoryTests
{
    private sealed class Fixture : IDisposable
    {
        private sealed class SingleContextFactory(DbContextOptions<AppDbContext> options) : IDbContextFactory<AppDbContext>
        {
            public AppDbContext CreateDbContext() => new(options);
        }

        private readonly SqliteConnection _connection;

        public ConvertibleBondRepository Repo { get; }

        public Fixture()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options;
            using (var ctx = new AppDbContext(options))
                ctx.Database.EnsureCreated();

            Repo = new ConvertibleBondRepository(new SingleContextFactory(options));
        }

        public void Dispose() => _connection.Dispose();
    }

    [Fact]
    public async Task UpsertAsync_ThenGetBySymbol_RoundTrips()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertAsync(new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101"));
        var found = await fx.Repo.GetBySymbolAsync("11011");

        Assert.NotNull(found);
        Assert.Equal(36.5m, found!.ConversionPrice);
    }

    [Fact]
    public async Task UpsertAsync_Existing_UpdatesTerms()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertAsync(new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101"));
        await fx.Repo.UpsertAsync(new ConvertibleBond("11011", "台泥一永", 100_000m, 34.0m, "1101"));
        var all = await fx.Repo.GetAllAsync();

        var bond = Assert.Single(all);
        Assert.Equal(34.0m, bond.ConversionPrice);
    }
}
