using AppName.Domain.Entities;

namespace AppName.Domain.Abstractions;

/// <summary>
/// Local persistence of daily convertible-bond valuation snapshots.
/// </summary>
public interface IValuationSnapshotRepository
{
    /// <summary>
    /// Returns all cached valuation snapshots.
    /// </summary>
    Task<IReadOnlyList<BondValuationSnapshot>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Inserts each snapshot, or overwrites the existing snapshot for that symbol.
    /// </summary>
    Task UpsertManyAsync(IEnumerable<BondValuationSnapshot> snapshots, CancellationToken ct = default);
}
