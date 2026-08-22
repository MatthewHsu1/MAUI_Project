using AppName.Domain.Querying;

namespace AppName.Domain.ValueObjects;

/// <summary>
/// One node of a valuation snapshot filter tree. A node carries its own leaf
/// values and its child <see cref="Groups"/>, so the same type describes a flat
/// filter and a nested one.
/// </summary>
/// <param name="Symbol">Prefix match on the bond symbol, case-sensitive.</param>
/// <param name="InTheMoney">Exact match on the in-the-money flag. A null-flagged row matches neither value.</param>
/// <param name="MinConversionValue">Inclusive lower bound on the conversion value.</param>
/// <param name="MaxConversionValue">Inclusive upper bound on the conversion value.</param>
/// <param name="MinBondPrice">Inclusive lower bound on the bond price. Excludes null-priced rows.</param>
/// <param name="MaxBondPrice">Inclusive upper bound on the bond price. Excludes null-priced rows.</param>
/// <param name="AsOfFrom">Inclusive earliest trading date.</param>
/// <param name="AsOfTo">Inclusive latest trading date.</param>
public sealed record ValuationFilter(
    string? Symbol = null,
    bool? InTheMoney = null,
    decimal? MinConversionValue = null,
    decimal? MaxConversionValue = null,
    decimal? MinBondPrice = null,
    decimal? MaxBondPrice = null,
    DateOnly? AsOfFrom = null,
    DateOnly? AsOfTo = null) : IFilterNode<ValuationFilter>
{
    /// <summary>
    /// The filter that restricts nothing. Callers that page an unfiltered
    /// collection share this instance instead of allocating an empty node.
    /// </summary>
    public static readonly ValuationFilter None = new();

    /// <summary>
    /// How this node joins its own leaves and its child groups.
    /// </summary>
    public LogicalOperator Operator { get; init; } = LogicalOperator.And;

    /// <summary>
    /// The child nodes nested under this one. Empty for a flat filter.
    /// </summary>
    public IReadOnlyList<ValuationFilter> Groups { get; init; } = [];
}
