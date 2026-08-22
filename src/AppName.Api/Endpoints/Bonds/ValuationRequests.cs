using AppName.Api.Endpoints.Shared;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.AspNetCore.Mvc;

namespace AppName.Api.Endpoints.Bonds;

/// <summary>
/// The eight valuation filters, bound from the query string with
/// <c>[AsParameters]</c>. <c>GET /api/valuations/count</c> binds this type directly,
/// and <see cref="ValuationQueryRequest"/> extends it with paging and sorting, so the
/// two endpoints cannot drift apart: a filter one honoured and the other ignored would
/// make the grid's scrollbar disagree with its rows.
/// <para>
/// Every property carries <see cref="FromQueryAttribute"/> with an explicit camelCase
/// name. Without it the OpenAPI document advertises the CLR names (<c>MinBondPrice</c>),
/// the generated TypeScript client sends those, and the wire contract stops matching
/// every other DTO in this API. The binder itself is case-insensitive, so the attribute
/// changes the document rather than what the server accepts.
/// </para>
/// </summary>
public record ValuationFilterRequest
{
    /// <summary>
    /// Prefix match on the bond symbol. The match is case-sensitive, because the symbols
    /// in this dataset are numeric and a case-insensitive match would need
    /// <c>EF.Functions.ILike</c>, which SQLite does not translate.
    /// </summary>
    [FromQuery(Name = "symbol")]
    public string? Symbol { get; init; }

    /// <summary>
    /// Exact match on the in-the-money flag. A row whose flag is null matches neither
    /// <c>true</c> nor <c>false</c>.
    /// </summary>
    [FromQuery(Name = "inTheMoney")]
    public bool? InTheMoney { get; init; }

    /// <summary>
    /// Inclusive lower bound on the conversion value.
    /// </summary>
    [FromQuery(Name = "minConversionValue")]
    public decimal? MinConversionValue { get; init; }

    /// <summary>
    /// Inclusive upper bound on the conversion value.
    /// </summary>
    [FromQuery(Name = "maxConversionValue")]
    public decimal? MaxConversionValue { get; init; }

    /// <summary>
    /// Inclusive lower bound on the bond price. Excludes rows with no bond quote.
    /// </summary>
    [FromQuery(Name = "minBondPrice")]
    public decimal? MinBondPrice { get; init; }

    /// <summary>
    /// Inclusive upper bound on the bond price. Excludes rows with no bond quote.
    /// </summary>
    [FromQuery(Name = "maxBondPrice")]
    public decimal? MaxBondPrice { get; init; }

    /// <summary>
    /// Inclusive earliest trading date.
    /// </summary>
    [FromQuery(Name = "asOfFrom")]
    public DateOnly? AsOfFrom { get; init; }

    /// <summary>
    /// Inclusive latest trading date.
    /// </summary>
    [FromQuery(Name = "asOfTo")]
    public DateOnly? AsOfTo { get; init; }

    /// <summary>
    /// Converts the bound values into the domain filter, rejecting a range whose lower
    /// bound sits above its upper bound.
    /// <para>
    /// The range check lives here rather than in <see cref="ValuationFilter"/> because a
    /// reversed range is a malformed request, not an invalid domain state. The domain
    /// type is happy to describe an empty match; a caller who asks for a bond priced
    /// above 100 and below 50 has made a mistake and needs a 400, not an empty array.
    /// </para>
    /// </summary>
    /// <param name="filter">The domain filter, valid only when this method returns true.</param>
    /// <param name="errors">One entry per rejected parameter, keyed by its wire name.</param>
    /// <returns>True when every range is ordered.</returns>
    public bool TryToFilter(out ValuationFilter filter, out Dictionary<string, string[]> errors)
    {
        errors = [];

        Check(MinConversionValue, MaxConversionValue, "minConversionValue", "maxConversionValue", errors);
        Check(MinBondPrice, MaxBondPrice, "minBondPrice", "maxBondPrice", errors);
        Check(AsOfFrom, AsOfTo, "asOfFrom", "asOfTo", errors);

        filter = new ValuationFilter(
            Symbol,
            InTheMoney,
            MinConversionValue,
            MaxConversionValue,
            MinBondPrice,
            MaxBondPrice,
            AsOfFrom,
            AsOfTo);

        return errors.Count == 0;
    }

    /// <summary>
    /// Records an error against the lower bound when a supplied range runs backwards.
    /// </summary>
    /// <typeparam name="T">Comparable bound type.</typeparam>
    /// <param name="min">Lower bound, or null when the caller omitted it.</param>
    /// <param name="max">Upper bound, or null when the caller omitted it.</param>
    /// <param name="minName">Wire name of the lower bound, used as the error key.</param>
    /// <param name="maxName">Wire name of the upper bound, named in the message.</param>
    /// <param name="errors">Collects one entry per rejected parameter.</param>
    private static void Check<T>(
        T? min,
        T? max,
        string minName,
        string maxName,
        Dictionary<string, string[]> errors)
        where T : struct, IComparable<T>
    {
        // A half-open range is legitimate, so only a pair of supplied bounds is compared.
        if (min is { } low && max is { } high && low.CompareTo(high) > 0)
        {
            errors[minName] = [$"{minName} must not be greater than {maxName}."];
        }
    }
}

/// <summary>
/// The eight filters plus the paging and sorting parameters, bound from the query string
/// with <c>[AsParameters]</c> for <c>GET /api/valuations</c>.
/// <para>
/// Inheriting the filters is deliberate and verified: minimal-API <c>[AsParameters]</c>
/// binding reflects over <c>Type.GetProperties()</c> without <c>BindingFlags.DeclaredOnly</c>,
/// so base-declared properties bind, and the OpenAPI document lists all thirteen
/// parameters. The compile-time request-delegate generator walks only the declared type,
/// so enabling Native AOT or <c>EnableRequestDelegateGenerator</c> would silently leave
/// the eight inherited filters at null. This project enables neither. Flatten this type
/// before turning either on.
/// </para>
/// </summary>
public sealed record ValuationQueryRequest : ValuationFilterRequest
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
    /// Rows to skip. An offset past the end of the match returns an empty array rather
    /// than an error, because a grid scrolled to a shrinking result set asks for one.
    /// </summary>
    [FromQuery(Name = "offset")]
    public int? Offset { get; init; }

    /// <summary>
    /// Rows to return, from 1 to 500 inclusive. Defaults to 100.
    /// </summary>
    [FromQuery(Name = "limit")]
    public int? Limit { get; init; }

    /// <summary>
    /// Column to order by, as a camelCase <see cref="ValuationSortField"/> name.
    /// Defaults to <c>symbol</c>.
    /// </summary>
    [FromQuery(Name = "sortField")]
    public string? SortField { get; init; }

    /// <summary>
    /// Direction to order in, as a camelCase <see cref="SortDirection"/> name.
    /// Defaults to <c>asc</c>.
    /// </summary>
    [FromQuery(Name = "sortDir")]
    public string? SortDir { get; init; }

    /// <summary>
    /// Where the null values of the sorted column sit, as a camelCase
    /// <see cref="NullPlacement"/> name. Defaults to <c>last</c>.
    /// </summary>
    [FromQuery(Name = "nulls")]
    public string? Nulls { get; init; }

    /// <summary>
    /// Converts the bound values into the domain query, applying every default and
    /// rejecting a malformed range, offset, limit, or sort value.
    /// <para>
    /// Each property is nullable and each default is applied here rather than as a C#
    /// initialiser. A non-nullable <c>int Limit</c> would make OpenAPI advertise
    /// <c>limit</c> as required, or silently document its default as 0, and a caller
    /// reading the generated client would believe it had to send one.
    /// </para>
    /// </summary>
    /// <param name="query">The domain query, valid only when this method returns true.</param>
    /// <param name="errors">One entry per rejected parameter, keyed by its wire name.</param>
    /// <returns>True when every parameter is within range.</returns>
    public bool TryToQuery(out ValuationQuery query, out Dictionary<string, string[]> errors)
    {
        TryToFilter(out var filter, out errors);

        if (Offset is < 0)
        {
            errors["offset"] = ["offset must not be negative."];
        }

        // An out-of-range limit is rejected, never clamped. A silent clamp makes a client
        // that asks for 1000 rows read 100 and believe it read 1000, so its next request
        // starts at offset 1000 and the 400 rows in between are never shown.
        if (Limit is < 1 or > MaxLimit)
        {
            errors["limit"] = [$"limit must be between 1 and {MaxLimit}."];
        }

        var sort = new SortSpec<ValuationSortField>(
            EnumWire.Parse(SortField, ValuationSortField.Symbol, "sortField", errors),
            EnumWire.Parse(SortDir, SortDirection.Asc, "sortDir", errors),
            EnumWire.Parse(Nulls, NullPlacement.Last, "nulls", errors));

        query = new ValuationQuery(filter, sort, Offset ?? 0, Limit ?? DefaultLimit);

        return errors.Count == 0;
    }
}
