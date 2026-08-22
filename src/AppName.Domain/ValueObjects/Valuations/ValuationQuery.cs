using AppName.Domain.Querying;

namespace AppName.Domain.ValueObjects.Valuations;

/// <summary>
/// One window over the cached valuation snapshots: what to keep, in what order,
/// and which slice of that order to return.
/// </summary>
/// <param name="Filter">The filter tree the rows must satisfy.</param>
/// <param name="Sort">The column, direction, and null placement of the order.</param>
/// <param name="Offset">Rows to skip. An offset past the end yields no rows.</param>
/// <param name="Limit">Maximum rows to return.</param>
public sealed record ValuationQuery(
    ValuationFilter Filter,
    SortSpec<ValuationSortField> Sort,
    int Offset,
    int Limit);
