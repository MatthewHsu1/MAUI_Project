using AppName.Api.Endpoints.Shared;
using AppName.Application.Dtos.Bonds;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects.Valuations;

namespace AppName.Api.Endpoints.Bonds;

/// <summary>
/// One node of the filter tree that <c>POST /api/valuations/query</c> accepts. A node
/// carries its own leaf values and its child <see cref="Groups"/>, which is the shape
/// <see cref="ValuationFilter"/> models, so a node maps onto one domain node.
/// </summary>
public sealed record ValuationFilterNode
{
    /// <summary>
    /// How this node joins its own leaves and its child groups, as a camelCase
    /// <see cref="LogicalOperator"/> name. Defaults to <c>and</c>.
    /// </summary>
    public string? Operator { get; init; }

    /// <summary>
    /// Prefix match on the bond symbol, case-sensitive.
    /// </summary>
    public string? Symbol { get; init; }

    /// <summary>
    /// Exact match on the in-the-money flag. A row whose flag is null matches neither value.
    /// </summary>
    public bool? InTheMoney { get; init; }

    /// <summary>
    /// Inclusive lower bound on the conversion value.
    /// </summary>
    public decimal? MinConversionValue { get; init; }

    /// <summary>
    /// Inclusive upper bound on the conversion value.
    /// </summary>
    public decimal? MaxConversionValue { get; init; }

    /// <summary>
    /// Inclusive lower bound on the bond price. Excludes rows with no bond quote.
    /// </summary>
    public decimal? MinBondPrice { get; init; }

    /// <summary>
    /// Inclusive upper bound on the bond price. Excludes rows with no bond quote.
    /// </summary>
    public decimal? MaxBondPrice { get; init; }

    /// <summary>
    /// Inclusive earliest trading date.
    /// </summary>
    public DateOnly? AsOfFrom { get; init; }

    /// <summary>
    /// Inclusive latest trading date.
    /// </summary>
    public DateOnly? AsOfTo { get; init; }

    /// <summary>
    /// The child nodes nested under this one. Empty for a flat filter.
    /// </summary>
    public IReadOnlyList<ValuationFilterNode> Groups { get; init; } = [];
}

/// <summary>
/// The order one <c>POST /api/valuations/query</c> request asks for. Every member is
/// optional and every default matches the <c>GET</c> endpoint, so the two paths order
/// an unspecified request identically.
/// </summary>
public sealed record ValuationSortBody
{
    /// <summary>
    /// Column to order by, as a camelCase <see cref="ValuationSortField"/> name.
    /// Defaults to <c>symbol</c>.
    /// </summary>
    public string? Field { get; init; }

    /// <summary>
    /// Direction to order in, as a camelCase <see cref="SortDirection"/> name.
    /// Defaults to <c>asc</c>.
    /// </summary>
    public string? Direction { get; init; }

    /// <summary>
    /// Where the null values of the sorted column sit, as a camelCase
    /// <see cref="NullPlacement"/> name. Defaults to <c>last</c>.
    /// </summary>
    public string? Nulls { get; init; }
}

/// <summary>
/// The request body of <c>POST /api/valuations/query</c>: a nested AND/OR filter tree,
/// an order, and a window. This is the ad-hoc and reporting path; the grid uses the
/// <c>GET</c> endpoints.
/// <para>
/// Every member is declared as an optional property rather than a positional record
/// parameter. A positional parameter with no default is required for deserialization,
/// which OpenAPI reports as a required field, so a caller who wants the first hundred
/// unfiltered rows would have to send all four.
/// </para>
/// </summary>
public sealed record ValuationQueryBody
{
    /// <summary>
    /// The default window size, applied when the caller omits <see cref="Limit"/>.
    /// </summary>
    private const int DefaultLimit = 100;

    /// <summary>
    /// The largest window a caller may ask for. A request above it is rejected.
    /// </summary>
    private const int MaxLimit = 500;

    /// <summary>
    /// The deepest the filter tree may nest, counting the root as level 1.
    /// </summary>
    private const int MaxDepth = 4;

    /// <summary>
    /// The most nodes the filter tree may hold, counting the root.
    /// </summary>
    private const int MaxNodes = 50;

    /// <summary>
    /// The filter tree. Null restricts nothing.
    /// </summary>
    public ValuationFilterNode? Filter { get; init; }

    /// <summary>
    /// The order to return the window in. Null takes every sort default.
    /// </summary>
    public ValuationSortBody? Sort { get; init; }

    /// <summary>
    /// Rows to skip. Defaults to 0.
    /// </summary>
    public int? Offset { get; init; }

    /// <summary>
    /// Rows to return, from 1 to 500 inclusive. Defaults to 100.
    /// </summary>
    public int? Limit { get; init; }

    /// <summary>
    /// Converts the body into the domain query, applying every default and rejecting a
    /// tree past the limits, a malformed range, a bad offset or limit, and an unknown
    /// sort value.
    /// </summary>
    /// <param name="query">The domain query, valid only when this method returns true.</param>
    /// <param name="errors">One entry per rejected value, keyed by its path in the body.</param>
    /// <returns>True when the whole body is within range.</returns>
    public bool TryToQuery(out ValuationQuery query, out Dictionary<string, string[]> errors)
    {
        errors = [];

        var filter = ValuationFilter.None;

        if (Filter is { } root)
        {
            // The size guard runs to completion before a single predicate is built. It is
            // the walk itself that has to stay bounded, so nothing may recurse over the
            // tree until the tree is known to be small enough to recurse over.
            var count = 0;

            if (Validate(root, depth: 1, ref count, errors))
            {
                filter = ToFilter(root, "filter", errors);
            }
        }

        if (Offset is < 0)
        {
            errors["offset"] = ["offset must not be negative."];
        }

        // Rejected rather than clamped, for the reason given on the GET request: a client
        // that asks for 1000 rows and silently reads 100 skips the 400 rows in between.
        if (Limit is < 1 or > MaxLimit)
        {
            errors["limit"] = [$"limit must be between 1 and {MaxLimit}."];
        }

        var sort = new SortSpec<ValuationSortField>(
            EnumWire.Parse(Sort?.Field, ValuationSortField.Symbol, "sort.field", errors),
            EnumWire.Parse(Sort?.Direction, SortDirection.Asc, "sort.direction", errors),
            EnumWire.Parse(Sort?.Nulls, NullPlacement.Last, "sort.nulls", errors));

        query = new ValuationQuery(filter, sort, Offset ?? 0, Limit ?? DefaultLimit);

        return errors.Count == 0;
    }

    /// <summary>
    /// Walks the filter tree and rejects one that nests deeper than <see cref="MaxDepth"/>
    /// or holds more than <see cref="MaxNodes"/> nodes.
    /// <para>
    /// Neither limit is defensive coding. Building the predicate recurses, so an unbounded
    /// tree is a stack-overflow path, and a wide tree becomes a <c>WHERE</c> clause the
    /// query planner cannot handle. <c>System.Text.Json</c> already refuses to deserialize
    /// past <see cref="System.Text.Json.JsonSerializerOptions.MaxDepth"/>, 64 by default,
    /// so a deeper body fails as a <c>JsonException</c> before this method ever runs. That
    /// default guards the deserializer's stack; these limits guard the query planner, which
    /// a 60-level tree would reach comfortably within it.
    /// </para>
    /// </summary>
    /// <param name="node">Node to check, then its children.</param>
    /// <param name="depth">Level of <paramref name="node"/>, counting the root as 1.</param>
    /// <param name="count">Running node total, carried across the whole walk.</param>
    /// <param name="errors">Collects the first limit the tree breaks.</param>
    /// <returns>True when this node and everything below it are within both limits.</returns>
    private static bool Validate(
        ValuationFilterNode node,
        int depth,
        ref int count,
        Dictionary<string, string[]> errors)
    {
        // Tested on entry, before recursing, so this walk can never nest past MaxDepth
        // frames however deep the caller's tree goes.
        if (depth > MaxDepth)
        {
            errors["filter"] = [$"filter must not nest deeper than {MaxDepth} levels."];

            return false;
        }

        count++;

        if (count > MaxNodes)
        {
            errors["filter"] = [$"filter must not hold more than {MaxNodes} nodes."];

            return false;
        }

        foreach (var child in node.Groups)
        {
            if (!Validate(child, depth + 1, ref count, errors))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Maps one validated node, and everything below it, onto the domain filter tree.
    /// </summary>
    /// <param name="node">Node to map. Already known to be within the size limits.</param>
    /// <param name="path">
    /// Position of <paramref name="node"/> in the body, such as
    /// <c>filter.groups[0]</c>. Errors are keyed by it, so two nodes that both reverse a
    /// range produce two entries instead of overwriting one another.
    /// </param>
    /// <param name="errors">Collects one entry per rejected value.</param>
    /// <returns>The domain filter for this node.</returns>
    private static ValuationFilter ToFilter(
        ValuationFilterNode node,
        string path,
        Dictionary<string, string[]> errors)
    {
        Check(node.MinConversionValue, node.MaxConversionValue, path, "minConversionValue", "maxConversionValue", errors);
        Check(node.MinBondPrice, node.MaxBondPrice, path, "minBondPrice", "maxBondPrice", errors);
        Check(node.AsOfFrom, node.AsOfTo, path, "asOfFrom", "asOfTo", errors);

        var groups = new ValuationFilter[node.Groups.Count];

        for (var i = 0; i < groups.Length; i++)
        {
            groups[i] = ToFilter(node.Groups[i], $"{path}.groups[{i}]", errors);
        }

        return new ValuationFilter(
            node.Symbol,
            node.InTheMoney,
            node.MinConversionValue,
            node.MaxConversionValue,
            node.MinBondPrice,
            node.MaxBondPrice,
            node.AsOfFrom,
            node.AsOfTo)
        {
            Operator = EnumWire.Parse(node.Operator, LogicalOperator.And, $"{path}.operator", errors),
            Groups = groups,
        };
    }

    /// <summary>
    /// Records an error against the lower bound when a supplied range runs backwards.
    /// </summary>
    /// <typeparam name="T">Comparable bound type.</typeparam>
    /// <param name="min">Lower bound, or null when the caller omitted it.</param>
    /// <param name="max">Upper bound, or null when the caller omitted it.</param>
    /// <param name="path">Position of the owning node in the body.</param>
    /// <param name="minName">Name of the lower bound, used in the error key.</param>
    /// <param name="maxName">Name of the upper bound, named in the message.</param>
    /// <param name="errors">Collects one entry per rejected value.</param>
    private static void Check<T>(
        T? min,
        T? max,
        string path,
        string minName,
        string maxName,
        Dictionary<string, string[]> errors)
        where T : struct, IComparable<T>
    {
        // A half-open range is legitimate, so only a pair of supplied bounds is compared.
        if (min is { } low && max is { } high && low.CompareTo(high) > 0)
        {
            errors[$"{path}.{minName}"] = [$"{minName} must not be greater than {maxName}."];
        }
    }
}

/// <summary>
/// The response of <c>POST /api/valuations/query</c>: one window and the total the same
/// filter matches.
/// </summary>
/// <param name="Items">The valuations inside the requested offset and limit.</param>
/// <param name="Total">Rows the filter matches, ignoring the offset and the limit.</param>
public sealed record ValuationPageDto(
    IReadOnlyList<ConversionValuationDto> Items,
    int Total);

/// <summary>
/// The response of <c>GET /api/valuations/count</c>. The total travels as an object
/// rather than a bare integer, matching the shape the grid already reads in
/// <c>testRowQueries.ts</c> and leaving room for a second field without breaking callers.
/// </summary>
/// <param name="Count">Rows the filter matches.</param>
public sealed record CountDto(int Count);
