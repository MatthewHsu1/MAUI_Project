using System.Linq.Expressions;
using AppName.Domain.Entities.Bonds;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects.Valuations;
using AppName.Infrastructure.Persistence.Context;
using AppName.Infrastructure.Querying;

namespace AppName.Infrastructure.Persistence.Bonds;

/// <summary>
/// Translates a <see cref="ValuationFilter"/> and a
/// <see cref="SortSpec{ValuationSortField}"/> into one snapshot query. The base
/// class owns the recursion, the paging, and the tie-break rule; this class
/// supplies only the per-entity parts.
/// </summary>
internal sealed class ValuationSnapshotQueryBuilder(AppDbContext context)
    : QueryBuilderBase<ValuationSnapshotQueryBuilder, BondValuationSnapshot, ValuationFilter, ValuationSortField>(context)
{
    /// <inheritdoc/>
    /// <remarks>
    /// Each leaf is a typed expression closing over a local, so EF sends the
    /// value as a parameter and never re-parses it from a string. A value the
    /// caller left null yields no leaf at all.
    /// </remarks>
    protected override IEnumerable<Expression<Func<BondValuationSnapshot, bool>>> BuildLeaves(ValuationFilter filter)
    {
        // An empty symbol would match every row, so it is not a restriction.
        if (filter.Symbol is { Length: > 0 } symbol)
            yield return x => x.Symbol.StartsWith(symbol);

        // A row with a null flag matches neither true nor false, which is the
        // SQL result of comparing NULL to a parameter.
        if (filter.InTheMoney is { } inTheMoney)
            yield return x => x.IsInTheMoney == inTheMoney;

        if (filter.MinConversionValue is { } minConversionValue)
            yield return x => x.ConversionValue >= minConversionValue;

        if (filter.MaxConversionValue is { } maxConversionValue)
            yield return x => x.ConversionValue <= maxConversionValue;

        // Both bond-price bounds drop null-priced rows, because a comparison
        // against NULL is unknown and never passes the WHERE clause.
        if (filter.MinBondPrice is { } minBondPrice)
            yield return x => x.BondPrice >= minBondPrice;

        if (filter.MaxBondPrice is { } maxBondPrice)
            yield return x => x.BondPrice <= maxBondPrice;

        if (filter.AsOfFrom is { } asOfFrom)
            yield return x => x.AsOf >= asOfFrom;

        if (filter.AsOfTo is { } asOfTo)
            yield return x => x.AsOf <= asOfTo;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The two nullable columns route through <c>OrderNullable</c>, because
    /// PostgreSQL and SQLite disagree on where they put nulls by default.
    /// </remarks>
    protected override IOrderedQueryable<BondValuationSnapshot> ApplySort(
        IQueryable<BondValuationSnapshot> query,
        SortSpec<ValuationSortField> sort) => sort.Field switch
        {
            ValuationSortField.Symbol => Order(query, x => x.Symbol, sort.Direction),
            ValuationSortField.ConversionShares => Order(query, x => x.ConversionShares, sort.Direction),
            ValuationSortField.ConversionValue => Order(query, x => x.ConversionValue, sort.Direction),
            ValuationSortField.StockPrice => Order(query, x => x.StockPrice, sort.Direction),
            ValuationSortField.AsOf => Order(query, x => x.AsOf, sort.Direction),
            ValuationSortField.BondPrice =>
                OrderNullable(query, x => x.BondPrice == null, x => x.BondPrice, sort.Direction, sort.Nulls),
            ValuationSortField.IsInTheMoney =>
                OrderNullable(query, x => x.IsInTheMoney == null, x => x.IsInTheMoney, sort.Direction, sort.Nulls),
            _ => throw new ArgumentOutOfRangeException(nameof(sort), sort.Field, "Unknown valuation sort field."),
        };

    /// <inheritdoc/>
    /// <remarks>
    /// A sort on Symbol needs no tie-break, because Symbol is the primary key,
    /// so that order is already total. Every other column can repeat a value,
    /// and two windows over a non-total order can show one row twice or lose it.
    /// </remarks>
    protected override IOrderedQueryable<BondValuationSnapshot> ApplyTieBreak(
        IOrderedQueryable<BondValuationSnapshot> query,
        SortSpec<ValuationSortField> sort) =>
        sort.Field == ValuationSortField.Symbol ? query : query.ThenBy(x => x.Symbol);
}
