using System.ComponentModel;

namespace AppName.Application.Dtos;

/// <summary>
/// One window of conversion valuations together with the total row count the
/// same filter matches. The pair travels as one value because the count and the
/// slice come from one filter tree, so they cannot disagree.
/// </summary>
/// <param name="Items">The valuations inside the requested offset and limit.</param>
/// <param name="Total">
/// Rows the filter matches, ignoring the offset and the limit. A scrollbar sizes
/// itself from this number, so it counts the whole match, not the window.
/// </param>
public sealed record ValuationPage(
    [property: DisplayName("Items")] IReadOnlyList<ConversionValuationDto> Items,
    [property: DisplayName("Total")] int Total);
