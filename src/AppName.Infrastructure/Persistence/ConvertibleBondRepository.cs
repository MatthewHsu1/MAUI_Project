using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

/// <inheritdoc/>
public sealed class ConvertibleBondRepository(IDbContextFactory<AppDbContext> factory) : IConvertibleBondRepository
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<ConvertibleBond>> GetAllAsync(CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();
        return await db.ConvertibleBonds.AsNoTracking().ToListAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<ConvertibleBond?> GetBySymbolAsync(string symbol, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();
        return await db.ConvertibleBonds.AsNoTracking().FirstOrDefaultAsync(b => b.Symbol == symbol, ct);
    }

    /// <inheritdoc/>
    public async Task UpsertAsync(ConvertibleBond bond, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();
        var existing = await db.ConvertibleBonds.FirstOrDefaultAsync(b => b.Symbol == bond.Symbol, ct);

        if (existing is null)
        {
            db.ConvertibleBonds.Add(bond);
        }
        else
        {
            existing.UpdateTerms(bond.ParValue, bond.ConversionPrice);
        }

        await db.SaveChangesAsync(ct);
    }
}
