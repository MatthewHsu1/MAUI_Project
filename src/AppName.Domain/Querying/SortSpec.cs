namespace AppName.Domain.Querying;

/// <summary>
/// Direction of one sorted column.
/// </summary>
public enum SortDirection
{
    /// <summary>
    /// Smallest value first.
    /// </summary>
    Asc,

    /// <summary>
    /// Largest value first.
    /// </summary>
    Desc
}

/// <summary>
/// Where the null values of a sorted column sit, relative to the values that are not null.
/// The caller always states this, because the two database providers disagree: PostgreSQL
/// places nulls last on <c>ASC</c> and first on <c>DESC</c>, and SQLite does the opposite.
/// </summary>
public enum NullPlacement
{
    /// <summary>
    /// Null values come before the values that are not null.
    /// </summary>
    First,

    /// <summary>
    /// Null values come after the values that are not null.
    /// </summary>
    Last
}

/// <summary>
/// The order of one column. <typeparamref name="TField"/> is the per-aggregate enum that
/// lists the sortable columns, so the enum is also the allow-list: a value outside it does
/// not parse, and no hand-written runtime check is needed.
/// </summary>
/// <typeparam name="TField">Enum naming the sortable columns of one aggregate.</typeparam>
/// <param name="Field">Column to sort on.</param>
/// <param name="Direction">Direction to sort in.</param>
/// <param name="Nulls">Placement of the null values of the column.</param>
public sealed record SortSpec<TField>(TField Field, SortDirection Direction, NullPlacement Nulls)
    where TField : struct, Enum;
