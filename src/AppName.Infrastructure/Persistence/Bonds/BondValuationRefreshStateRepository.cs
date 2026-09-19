using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Bonds;
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
                BondValuationRefreshState.SingletonId, state.LastAsOf, state.LastAttemptDate, state.NextAttemptNotBefore));
        }
        else
        {
            existing.Update(state.LastAsOf, state.LastAttemptDate, state.NextAttemptNotBefore);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<bool> TryClaimAttemptAsync(BondValuationRefreshClaim claim, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        var expectedDataDate = claim.ExpectedDataDate;
        var taiwanToday = claim.TaiwanToday;
        var closePublishGraceOpen = claim.IsClosePublishGraceOpen;
        var now = claim.Now;
        var nextAttemptNotBefore = claim.NextAttemptNotBefore;

        // ExecuteUpdateAsync keeps the compare and the set inside one UPDATE
        // statement, so the database decides the winner. Raw SQL is not an
        // option here: the natural predicate is IS DISTINCT FROM, and SQLite
        // does not support it, but the repository tests run on SQLite.
        var claimed = await db.BondValuationRefreshStates
            .Where(r => r.Id == BondValuationRefreshState.SingletonId
                     // Freshness is judged by the data, not by the attempt. A pull
                     // that ran before the exchange published leaves LastAsOf behind.
                     // The null arm is REQUIRED: SQL evaluates NULL < @date as NULL,
                     // not true, so without it the very first claim of all time
                     // matches no row and the refresh never starts.
                     && (r.LastAsOf == null || r.LastAsOf < expectedDataDate)
                     // Once the grace period closes, a day that still has not
                     // published its own close was not a trading day. Without this
                     // arm every Taiwan holiday costs a whole-market pull per
                     // interval until midnight.
                     && (closePublishGraceOpen || r.LastAttemptDate == null || r.LastAttemptDate < taiwanToday)
                     // Every attempt stamps this. While a refresh runs it is the
                     // mutex that keeps a second caller out; afterwards it is the
                     // throttle that paces retries. Its null arm is required for
                     // the same reason as above.
                     && (r.NextAttemptNotBefore == null || r.NextAttemptNotBefore <= now))
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.LastAttemptDate, taiwanToday)
                .SetProperty(r => r.NextAttemptNotBefore, (DateTime?)nextAttemptNotBefore), ct);

        // Zero rows means the cache is already current, the day has been shown not
        // to trade, or another caller's attempt still holds the marker.
        return claimed > 0;
    }

    /// <inheritdoc/>
    public async Task SetNextAttemptAsync(DateTime notBefore, CancellationToken ct = default)
    {
        await using var db = factory.CreateDbContext();

        // LastAttemptDate is deliberately left stamped. It still records when the
        // attempt happened; NextAttemptNotBefore alone is what reopens the claim.
        await db.BondValuationRefreshStates
            .Where(r => r.Id == BondValuationRefreshState.SingletonId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.NextAttemptNotBefore, (DateTime?)notBefore), ct);
    }
}
