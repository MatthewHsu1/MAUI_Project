using AppName.Api.Authentication;
using AppName.Api.Cors;
using AppName.Api.Endpoints.Auth;
using AppName.Api.Endpoints.Bonds;
using AppName.Api.OpenApi;
using AppName.Application;
using AppName.Infrastructure;
using Scalar.AspNetCore;
using SecretKeysConstants = AppName.Api.SecretKeysConstants;

var builder = WebApplication.CreateBuilder(args);

// --- Composition -----------------------------------------------------------

builder.Services.AddApplication().AddInfrastructure(builder.Configuration);

// --- OpenAPI -----------------------------------------------------------

builder.Services.AddOpenApi(options =>
{
    options.AddSchemaTransformer<NumericSchemaTransformer>();
    options.AddSchemaTransformer<ValuationEnumSchemaTransformer>();
});

// --- Auth (JWT bearer, dev stub) ----------------------------------------

builder.Services.AddJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();

// --- CORS ----------------------------------------------------------------

builder.Services.AddApiCors(builder.Configuration);

var app = builder.Build();

app.MapOpenApi();

if (app.Environment.IsDevelopment())
{
    app.MapScalarApiReference();
}

app.UseCors(SecretKeysConstants.Cors.PolicyName);
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
api.MapAuthEndpoints();
api.MapBondEndpoints();

app.Run();
