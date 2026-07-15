using AppName.Domain.Entities;

namespace AppName.Domain.Abstractions;

/// <summary>
/// Local persistence of convertible bonds and their terms.
/// </summary>
public interface IConvertibleBondRepository
{
    /// <summary>
    /// Returns all cached convertible bonds.
    /// </summary>
    Task<IReadOnlyList<ConvertibleBond>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Returns a single bond by symbol, or null if absent.
    /// </summary>
    Task<ConvertibleBond?> GetBySymbolAsync(string symbol, CancellationToken ct = default);

    /// <summary>
    /// Inserts the bond, or updates its terms if it already exists.
    /// </summary>
    Task UpsertAsync(ConvertibleBond bond, CancellationToken ct = default);
}
