using AppName.Domain.Entities.Bonds;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Domain.Abstractions.Bonds;

/// <summary>
/// Local persistence of daily convertible-bond valuation snapshots.
/// </summary>
public interface IValuationSnapshotRepository
{
    /// <summary>
    /// Returns one ordered slice of the snapshots the query keeps. The filter,
    /// the order, and the slice all run in the database.
    /// </summary>
    Task<IReadOnlyList<BondValuationSnapshot>> QueryAsync(ValuationQuery query, CancellationToken ct = default);

    /// <summary>
    /// Counts the snapshots the filter keeps. The parameter is the filter and
    /// not a <see cref="ValuationQuery"/>, because a count cannot depend on the
    /// offset, the limit, or the order.
    /// </summary>
    Task<int> CountAsync(ValuationFilter filter, CancellationToken ct = default);

    /// <summary>
    /// Inserts each snapshot, or overwrites the existing snapshot for that symbol.
    /// </summary>
    Task UpsertManyAsync(IEnumerable<BondValuationSnapshot> snapshots, CancellationToken ct = default);
}
