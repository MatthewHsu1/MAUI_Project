using AppName.Domain.Entities;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects;
using AppName.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AppName.Infrastructure.Tests.Persistence;

public class ValuationSnapshotRepositoryTests
{
    /// <summary>
    /// Maps every decimal property to a SQLite REAL column.
    /// </summary>
    /// <remarks>
    /// SQLite has no decimal type. EF writes a decimal as a TEXT literal, so it
    /// refuses to translate ORDER BY over one and compares one as text inside a
    /// WHERE clause. Every sort and every money bound in these tests needs a
    /// numeric column instead. The SQLite guard reads the provider type off the
    /// type mapping's converter, so a decimal-to-double converter satisfies it.
    /// The customizer runs only in this fixture; production uses Npgsql, which
    /// orders numeric natively and keeps full precision.
    /// </remarks>
    internal sealed class SqliteDecimalAsDouble(ModelCustomizerDependencies dependencies)
        : RelationalModelCustomizer(dependencies)
    {
        private static readonly ValueConverter<decimal, double> Required =
            new(v => (double)v, v => (decimal)v);

        private static readonly ValueConverter<decimal?, double?> Optional =
            new(v => v == null ? null : (double?)v.Value, v => v == null ? null : (decimal?)v.Value);

        public override void Customize(ModelBuilder modelBuilder, DbContext context)
        {
            // The base call runs AppDbContext.OnModelCreating, so every property
            // exists before the conversion is applied.
            base.Customize(modelBuilder, context);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes().ToList())
            {
                var entity = modelBuilder.Entity(entityType.ClrType);

                foreach (var property in entityType.GetProperties().ToList())
                {
                    if (property.ClrType == typeof(decimal))
                    {
                        entity.Property(property.Name).HasConversion(Required);
                    }
                    else if (property.ClrType == typeof(decimal?))
                    {
                        entity.Property(property.Name).HasConversion(Optional);
                    }
                }
            }
        }
    }

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

            var builder = new DbContextOptionsBuilder<AppDbContext>();
            builder.UseSqlite(_connection).ReplaceService<IModelCustomizer, SqliteDecimalAsDouble>();

            var options = builder.Options;

            using (var ctx = new AppDbContext(options))
                ctx.Database.EnsureCreated();

            Repo = new ValuationSnapshotRepository(new SingleContextFactory(options));
        }

        public void Dispose() => _connection.Dispose();
    }

    private static BondValuationSnapshot Snap(string symbol, decimal value, bool? itm) =>
        new(symbol, 2_000m, value, 60m, new DateOnly(2026, 7, 2), itm is null ? null : 100_000m, itm);

    /// <summary>
    /// A row with an explicit bond price, so a test can seed priced and
    /// null-priced rows side by side.
    /// </summary>
    private static BondValuationSnapshot Row(string symbol, decimal value, decimal? bondPrice, DateOnly? asOf = null) =>
        new(symbol,
            2_000m,
            value,
            60m,
            asOf ?? new DateOnly(2026, 7, 2),
            bondPrice,
            bondPrice is null ? (bool?)null : bondPrice < value);

    private static ValuationQuery Query(
        ValuationFilter filter,
        ValuationSortField field = ValuationSortField.Symbol,
        SortDirection direction = SortDirection.Asc,
        NullPlacement nulls = NullPlacement.Last,
        int offset = 0,
        int limit = 100) =>
        new(filter, new SortSpec<ValuationSortField>(field, direction, nulls), offset, limit);

    private static string[] Symbols(IReadOnlyList<BondValuationSnapshot> rows) =>
        rows.Select(r => r.Symbol).ToArray();

    [Fact]
    public async Task UpsertManyAsync_ThenQueryAsync_RoundTripsAllRows()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync([Snap("11011", 120_000m, true), Snap("33033", 80_000m, false)]);
        var all = await fx.Repo.QueryAsync(Query(ValuationFilter.None));

        Assert.Equal(2, all.Count);
        Assert.Contains(all, s => s.Symbol == "11011" && s.IsInTheMoney == true);
        Assert.Contains(all, s => s.Symbol == "33033" && s.IsInTheMoney == false);
    }

    [Fact]
    public async Task UpsertManyAsync_Existing_OverwritesInPlace_WithoutDuplicating()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync([Snap("11011", 120_000m, true)]);
        await fx.Repo.UpsertManyAsync([Snap("11011", 90_000m, false)]);
        var all = await fx.Repo.QueryAsync(Query(ValuationFilter.None));

        var only = Assert.Single(all);
        Assert.Equal(90_000m, only.ConversionValue);
        Assert.False(only.IsInTheMoney);
        Assert.Equal(1, await fx.Repo.CountAsync(ValuationFilter.None));
    }

    [Fact]
    public async Task UpsertManyAsync_PreservesNullBondPrice()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync([Snap("11011", 120_000m, null)]);
        var only = Assert.Single(await fx.Repo.QueryAsync(Query(ValuationFilter.None)));

        Assert.Null(only.BondPrice);
        Assert.Null(only.IsInTheMoney);
    }

    [Fact]
    public async Task QueryAsync_And_CountAsync_AgreeOnWhichRowsAFilterPasses()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),
            Row("22022", 200_000m, 150_000m),
            Row("33033", 300_000m, null),
            Row("44044", 50_000m, 40_000m),
        ]);

        var filter = new ValuationFilter(MinConversionValue: 150_000m);

        var rows = await fx.Repo.QueryAsync(Query(filter));
        var count = await fx.Repo.CountAsync(filter);

        Assert.Equal(new[] { "22022", "33033" }, Symbols(rows));
        Assert.Equal(rows.Count, count);
    }

    [Fact]
    public async Task CountAsync_ReturnsFilteredTotal_NotTableTotal()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),
            Row("11022", 100_000m, 95_000m),
            Row("22022", 100_000m, 95_000m),
            Row("33033", 100_000m, 95_000m),
            Row("44044", 100_000m, 95_000m),
        ]);

        Assert.Equal(5, await fx.Repo.CountAsync(ValuationFilter.None));
        Assert.Equal(2, await fx.Repo.CountAsync(new ValuationFilter(Symbol: "11")));
    }

    [Fact]
    public async Task CountAsync_IgnoresOffsetAndLimit()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),
            Row("22022", 110_000m, 95_000m),
            Row("33033", 120_000m, 95_000m),
            Row("44044", 130_000m, 95_000m),
            Row("55055", 140_000m, 95_000m),
        ]);

        var filter = new ValuationFilter(MinConversionValue: 100_000m);

        // The same filter also drives a two-row window. The count cannot see
        // that window, so it stays at the filtered total.
        var window = await fx.Repo.QueryAsync(Query(filter, offset: 1, limit: 2));

        Assert.Equal(2, window.Count);
        Assert.Equal(5, await fx.Repo.CountAsync(filter));
    }

    [Fact]
    public async Task QueryAsync_BondPriceDescending_NullsLast_PlacesNullRowsAfterPricedRows()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 90_000m),
            Row("22022", 100_000m, null),
            Row("33033", 100_000m, 120_000m),
            Row("44044", 100_000m, null),
        ]);

        var rows = await fx.Repo.QueryAsync(
            Query(ValuationFilter.None, ValuationSortField.BondPrice, SortDirection.Desc, NullPlacement.Last));

        Assert.Equal(new[] { "33033", "11011", "22022", "44044" }, Symbols(rows));
        Assert.All(rows.Take(2), r => Assert.NotNull(r.BondPrice));
        Assert.All(rows.Skip(2), r => Assert.Null(r.BondPrice));
    }

    [Fact]
    public async Task QueryAsync_BondPriceAscending_NullsLast_PlacesNullRowsAfterPricedRows()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 90_000m),
            Row("22022", 100_000m, null),
            Row("33033", 100_000m, 120_000m),
            Row("44044", 100_000m, null),
        ]);

        var rows = await fx.Repo.QueryAsync(
            Query(ValuationFilter.None, ValuationSortField.BondPrice, SortDirection.Asc, NullPlacement.Last));

        Assert.Equal(new[] { "11011", "33033", "22022", "44044" }, Symbols(rows));
        Assert.All(rows.Take(2), r => Assert.NotNull(r.BondPrice));
        Assert.All(rows.Skip(2), r => Assert.Null(r.BondPrice));
    }

    [Fact]
    public async Task QueryAsync_AdjacentWindows_OverTiedConversionValues_NeitherRepeatNorSkipARow()
    {
        using var fx = new Fixture();

        // Insertion order runs against symbol order inside each tie group, so a
        // query without the Symbol tie-break returns a different order.
        await fx.Repo.UpsertManyAsync(
        [
            Row("33033", 100_000m, 95_000m),
            Row("22022", 100_000m, 95_000m),
            Row("11011", 100_000m, 95_000m),
            Row("55055", 200_000m, 95_000m),
            Row("44044", 200_000m, 95_000m),
        ]);

        var first = await fx.Repo.QueryAsync(
            Query(ValuationFilter.None, ValuationSortField.ConversionValue, offset: 0, limit: 2));
        var second = await fx.Repo.QueryAsync(
            Query(ValuationFilter.None, ValuationSortField.ConversionValue, offset: 2, limit: 2));

        Assert.Equal(new[] { "11011", "22022" }, Symbols(first));
        Assert.Equal(new[] { "33033", "44044" }, Symbols(second));
        Assert.Empty(Symbols(first).Intersect(Symbols(second)));
    }

    [Fact]
    public async Task QueryAsync_OffsetPastTheEnd_ReturnsEmptyList()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync([Row("11011", 100_000m, 95_000m), Row("22022", 110_000m, 95_000m)]);

        var rows = await fx.Repo.QueryAsync(Query(ValuationFilter.None, offset: 50, limit: 10));

        Assert.Empty(rows);
    }

    [Fact]
    public async Task QueryAsync_MinBondPrice_ExcludesNullPricedRows()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),
            Row("22022", 100_000m, null),
            Row("33033", 100_000m, null),
        ]);

        var filter = new ValuationFilter(MinBondPrice: 1m);
        var rows = await fx.Repo.QueryAsync(Query(filter));

        Assert.Equal(new[] { "11011" }, Symbols(rows));
        Assert.Equal(1, await fx.Repo.CountAsync(filter));
    }

    [Fact]
    public async Task QueryAsync_NestedOrFilter_ReturnsTheUnionOfWhatTheGroupsMatch()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),
            Row("22022", 600_000m, 95_000m),
            Row("33033", 100_000m, 95_000m),
        ]);

        var filter = new ValuationFilter
        {
            Operator = LogicalOperator.Or,
            Groups =
            [
                new ValuationFilter(Symbol: "11"),
                new ValuationFilter(MinConversionValue: 500_000m),
            ],
        };

        var rows = await fx.Repo.QueryAsync(Query(filter));

        Assert.Equal(new[] { "11011", "22022" }, Symbols(rows));
        Assert.Equal(2, await fx.Repo.CountAsync(filter));
    }

    [Fact]
    public async Task QueryAsync_AsOfRange_KeepsOnlyRowsInsideTheInclusiveBounds()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m, new DateOnly(2026, 7, 1)),
            Row("22022", 100_000m, 95_000m, new DateOnly(2026, 7, 2)),
            Row("33033", 100_000m, 95_000m, new DateOnly(2026, 7, 3)),
            Row("44044", 100_000m, 95_000m, new DateOnly(2026, 7, 4)),
        ]);

        var filter = new ValuationFilter(
            AsOfFrom: new DateOnly(2026, 7, 2),
            AsOfTo: new DateOnly(2026, 7, 3));

        var rows = await fx.Repo.QueryAsync(Query(filter));

        Assert.Equal(new[] { "22022", "33033" }, Symbols(rows));
        Assert.Equal(2, await fx.Repo.CountAsync(filter));
    }

    [Fact]
    public async Task QueryAsync_IsInTheMoneyAscending_NullsLast_PlacesNullFlagsAfterBothValues()
    {
        using var fx = new Fixture();

        await fx.Repo.UpsertManyAsync(
        [
            Row("11011", 100_000m, 95_000m),    // in the money
            Row("22022", 100_000m, 120_000m),   // out of the money
            Row("33033", 100_000m, null),       // no bond quote, so no flag
        ]);

        var rows = await fx.Repo.QueryAsync(
            Query(ValuationFilter.None, ValuationSortField.IsInTheMoney, SortDirection.Asc, NullPlacement.Last));

        Assert.Equal(new[] { "22022", "11011", "33033" }, Symbols(rows));
        Assert.Null(rows[^1].IsInTheMoney);
    }
}
