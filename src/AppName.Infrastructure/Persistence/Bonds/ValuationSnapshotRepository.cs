using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Valuations;
using AppName.Infrastructure.Persistence.Context;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence.Bonds;

/// <inheritdoc/>
public sealed class ValuationSnapshotRepository(IDbContextFactory<AppDbContext> factory) : IValuationSnapshotRepository
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<BondValuationSnapshot>> QueryAsync(ValuationQuery query, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        return await new ValuationSnapshotQueryBuilder(db)
            .WithFilter(query.Filter)
            .WithSorting(query.Sort)
            .WithPage(query.Offset, query.Limit)
            .Build()
            .ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<int> CountAsync(ValuationFilter filter, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        // No sort and no page: neither changes a count, and both cost SQL.
        return await new ValuationSnapshotQueryBuilder(db)
            .WithFilter(filter)
            .Build()
            .CountAsync(ct);
    }

    /// <inheritdoc/>
    public async Task UpsertManyAsync(IEnumerable<BondValuationSnapshot> snapshots, CancellationToken ct = default)
    {
        var incoming = snapshots.ToList();

        if (incoming.Count == 0)
        {
            return;
        }

        await using var db = factory.CreateDbContext();

        var symbols = incoming.Select(s => s.Symbol).ToList();
        
        var existing = await db.BondValuationSnapshots
            .Where(s => symbols.Contains(s.Symbol))
            .ToDictionaryAsync(s => s.Symbol, ct);

        foreach (var snap in incoming)
        {
            if (existing.TryGetValue(snap.Symbol, out var row))
            {
                row.Update(snap.ConversionShares, snap.ConversionValue, snap.StockPrice, snap.AsOf, snap.BondPrice, snap.IsInTheMoney);
            }
            else
            {
                db.BondValuationSnapshots.Add(snap);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
