using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

/// <inheritdoc/>
public sealed class BondValuationRefreshStateRepository(IDbContextFactory<AppDbContext> factory) : IBondValuationRefreshStateRepository
{
    /// <inheritdoc/>
    public async Task<BondValuationRefreshState> GetAsync(CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        var row = await db.BondValuationRefreshStates
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == BondValuationRefreshState.SingletonId, ct);

        return row ?? new BondValuationRefreshState(BondValuationRefreshState.SingletonId, null, null);
    }

    /// <inheritdoc/>
    public async Task SetAsync(BondValuationRefreshState state, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        var existing = await db.BondValuationRefreshStates
            .FirstOrDefaultAsync(r => r.Id == BondValuationRefreshState.SingletonId, ct);

        if (existing is null)
        {
            db.BondValuationRefreshStates.Add(new BondValuationRefreshState(BondValuationRefreshState.SingletonId, state.LastAsOf, state.LastAttemptDate));
        }
        else
        {
            existing.Update(state.LastAsOf, state.LastAttemptDate);
        }

        await db.SaveChangesAsync(ct);
    }
}
