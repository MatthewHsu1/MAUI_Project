using AppName.Application.Dtos;
using AppName.Domain.Entities;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Projects a cached valuation snapshot onto its transport shape.
/// </summary>
/// <remarks>
/// The projection lives here, not on each read use case, because two use cases
/// return valuation DTOs. Four of the seven members are <see cref="decimal"/>, so
/// two hand-written copies could swap a pair of arguments and still compile.
/// </remarks>
internal static class ValuationSnapshotMapper
{
    /// <summary>
    /// Returns the DTO for one snapshot.
    /// </summary>
    /// <param name="s">The cached snapshot.</param>
    internal static ConversionValuationDto ToDto(this BondValuationSnapshot s) =>
        new(s.Symbol, s.ConversionShares, s.ConversionValue, s.StockPrice, s.AsOf, s.BondPrice, s.IsInTheMoney);
}
