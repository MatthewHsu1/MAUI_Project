using AppName.Application.Dtos;
using AppName.Application.UseCases.Bonds;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AppName.Api.Endpoints;

/// <summary>
/// Convertible-bond valuation and refresh endpoints.
/// </summary>
public static class BondEndpoints
{
    /// <summary>
    /// Maps the valuation/refresh endpoints under the given route group. All
    /// endpoints here require an authenticated caller.
    /// </summary>
    public static RouteGroupBuilder MapBondEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/valuations", async Task<Ok<IReadOnlyList<ConversionValuationDto>>> (GetValuationsUseCase useCase, CancellationToken ct) =>
        {
            var valuations = await useCase.ExecuteAsync(ct);
            return TypedResults.Ok(valuations);
        })
        .RequireAuthorization()
        .WithName("GetValuations");

        group.MapGet("/valuations/{symbol}", async Task<Results<Ok<ConversionValuationDto>, NotFound>> (string symbol, GetConversionValuationUseCase useCase, CancellationToken ct) =>
        {
            var valuation = await useCase.ExecuteAsync(symbol, ct);
            return valuation is null ? TypedResults.NotFound() : TypedResults.Ok(valuation);
        })
        .RequireAuthorization()
        .WithName("GetValuationBySymbol");

        group.MapPost("/valuations/refresh", async Task<Accepted> (IRefreshAllBondsUseCase useCase, CancellationToken ct) =>
        {
            await useCase.ExecuteAsync(ct);
            return TypedResults.Accepted((string?)null);
        })
        .RequireAuthorization()
        .WithName("RefreshAllValuations");

        group.MapPost("/bonds/{symbol}/refresh", async Task<Accepted> (string symbol, RefreshBondDataUseCase useCase, CancellationToken ct) =>
        {
            await useCase.ExecuteAsync(symbol, ct);
            return TypedResults.Accepted((string?)null);
        })
        .RequireAuthorization()
        .WithName("RefreshBondData");

        return group;
    }
}
