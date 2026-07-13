using AppName.Application.UseCases.Bonds;

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
        group.MapGet("/valuations", async (GetValuationsUseCase useCase, CancellationToken ct) =>
        {
            var valuations = await useCase.ExecuteAsync(ct);
            return Results.Ok(valuations);
        })
        .RequireAuthorization()
        .WithName("GetValuations");

        group.MapGet("/valuations/{symbol}", async (string symbol, GetConversionValuationUseCase useCase, CancellationToken ct) =>
        {
            var valuation = await useCase.ExecuteAsync(symbol, ct);
            return valuation is null ? Results.NotFound() : Results.Ok(valuation);
        })
        .RequireAuthorization()
        .WithName("GetValuationBySymbol");

        group.MapPost("/valuations/refresh", async (IRefreshAllBondsUseCase useCase, CancellationToken ct) =>
        {
            await useCase.ExecuteAsync(ct);
            return Results.Accepted();
        })
        .RequireAuthorization()
        .WithName("RefreshAllValuations");

        group.MapPost("/bonds/{symbol}/refresh", async (string symbol, RefreshBondDataUseCase useCase, CancellationToken ct) =>
        {
            await useCase.ExecuteAsync(symbol, ct);
            return Results.Accepted();
        })
        .RequireAuthorization()
        .WithName("RefreshBondData");

        return group;
    }
}
