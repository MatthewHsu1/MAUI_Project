using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Entities.Bonds;
using AppName.Infrastructure.Persistence.Context;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence.Bonds;

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
            db.BondValuationRefreshStates.Add(new BondValuationRefreshState(
                BondValuationRefreshState.SingletonId, state.LastAsOf, state.LastAttemptDate, state.RetryNotBefore));
        }
        else
        {
            existing.Update(state.LastAsOf, state.LastAttemptDate, state.RetryNotBefore);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<bool> TryClaimAttemptAsync(DateOnly today, DateTime now, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        // ExecuteUpdateAsync keeps the compare and the set inside one UPDATE
        // statement, so the database decides the winner. Raw SQL is not an
        // option here: the natural predicate is IS DISTINCT FROM, and SQLite
        // does not support it, but the repository tests run on SQLite.
        var claimed = await db.BondValuationRefreshStates
            .Where(r => r.Id == BondValuationRefreshState.SingletonId
                     // The null arm is REQUIRED. SQL evaluates NULL != @today as
                     // NULL, not true, so without it the very first claim of all
                     // time matches no row and the refresh never starts.
                     && (r.LastAttemptDate == null || r.LastAttemptDate != today
                         // A failed attempt gave the day back and named when it
                         // may be tried again. Clearing RetryNotBefore in the
                         // same statement is what stops two callers taking the
                         // retry, exactly as the day claim stops two taking the
                         // first attempt.
                         || (r.RetryNotBefore != null && r.RetryNotBefore <= now)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.LastAttemptDate, today)
                .SetProperty(r => r.RetryNotBefore, (DateTime?)null), ct);

        // Zero rows means another caller already claimed today.
        return claimed > 0;
    }

    /// <inheritdoc/>
    public async Task ReleaseClaimAsync(DateTime retryNotBefore, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        // LastAttemptDate is deliberately left stamped. It still records when
        // the attempt happened, and RetryNotBefore alone is what reopens the
        // claim -- see the second arm of the predicate above.
        await db.BondValuationRefreshStates
            .Where(r => r.Id == BondValuationRefreshState.SingletonId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.RetryNotBefore, (DateTime?)retryNotBefore), ct);
    }
}
