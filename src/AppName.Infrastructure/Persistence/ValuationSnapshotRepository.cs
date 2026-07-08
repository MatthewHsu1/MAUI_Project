using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

/// <inheritdoc/>
public sealed class ValuationSnapshotRepository(IDbContextFactory<AppDbContext> factory) : IValuationSnapshotRepository
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<BondValuationSnapshot>> GetAllAsync(CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        return await db.BondValuationSnapshots.AsNoTracking().ToListAsync(ct);
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
