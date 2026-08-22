namespace AppName.Domain.ValueObjects;

/// <summary>
/// The columns a valuation snapshot query can order by. The enum is the
/// allow-list: a value outside it cannot bind, so no sort column reaches the
/// database from caller input.
/// </summary>
public enum ValuationSortField
{
    /// <summary>
    /// Exchange ticker of the convertible bond.
    /// </summary>
    Symbol,

    /// <summary>
    /// Number of shares the bond converts into.
    /// </summary>
    ConversionShares,

    /// <summary>
    /// Market value of the converted shares.
    /// </summary>
    ConversionValue,

    /// <summary>
    /// Underlying stock's price used to compute the valuation.
    /// </summary>
    StockPrice,

    /// <summary>
    /// Trading date the valuation applies to.
    /// </summary>
    AsOf,

    /// <summary>
    /// Market price of the bond, which is nullable.
    /// </summary>
    BondPrice,

    /// <summary>
    /// Whether the bond is in the money, which is nullable.
    /// </summary>
    IsInTheMoney,
}
