using AppName.Application.Dtos.Bonds;
using AppName.Application.UseCases.Bonds;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AppName.Api.Endpoints.Bonds;

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
        group.MapGet("/valuations", async Task<Results<Ok<IReadOnlyList<ConversionValuationDto>>, ValidationProblem>> (
            [AsParameters] ValuationQueryRequest request, GetValuationsUseCase useCase, CancellationToken ct) =>
        {
            if (!request.TryToQuery(out var query, out var errors))
            {
                return TypedResults.ValidationProblem(errors);
            }

            var valuations = await useCase.ExecuteAsync(query, ct);

            return TypedResults.Ok(valuations);
        })
        .RequireAuthorization()
        .WithName("GetValuations");

        // The count is a separate endpoint, not a field on the response above, because the
        // grid keeps its total in its own cached query keyed on the view rather than the
        // window. An envelope on the GET would run one COUNT per window scroll and discard
        // every result.
        //
        // This route and "/valuations/{symbol}" share a shape. ASP.NET Core ranks a literal
        // segment above a parameter segment, so "count" never binds to {symbol}.
        group.MapGet("/valuations/count", async Task<Results<Ok<CountDto>, ValidationProblem>> (
            [AsParameters] ValuationFilterRequest request, GetValuationCountUseCase useCase, CancellationToken ct) =>
        {
            if (!request.TryToFilter(out var filter, out var errors))
            {
                return TypedResults.ValidationProblem(errors);
            }

            var count = await useCase.ExecuteAsync(filter, ct);

            return TypedResults.Ok(new CountDto(count));
        })
        .RequireAuthorization()
        .WithName("GetValuationCount");

        // This endpoint returns an envelope while the GET above returns a bare array. The
        // two callers differ. Splitting this one would force the caller to send the same
        // filter TREE twice, which invites two requests that disagree, and its slice and
        // total come from one filter on one context, so they cannot tear. The report caller
        // wants the total with the page; the grid does not.
        group.MapPost("/valuations/query", async Task<Results<Ok<ValuationPageDto>, ValidationProblem>> (
            ValuationQueryBody body, GetValuationPageUseCase useCase, CancellationToken ct) =>
        {
            if (!body.TryToQuery(out var query, out var errors))
            {
                return TypedResults.ValidationProblem(errors);
            }

            var page = await useCase.ExecuteAsync(query, ct);

            return TypedResults.Ok(new ValuationPageDto(page.Items, page.Total));
        })
        .RequireAuthorization()
        .WithName("QueryValuations");

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
