using AppName.Api.Authentication;
using AppName.Api.Cors;
using AppName.Api.Endpoints;
using SecretKeysConstants = AppName.Api.SecretKeysConstants;
using AppName.Application;
using AppName.Infrastructure;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// --- Composition -----------------------------------------------------------

builder.Services.AddApplication().AddInfrastructure(builder.Configuration);

// --- OpenAPI -----------------------------------------------------------

builder.Services.AddOpenApi();

// --- Auth (JWT bearer, dev stub) ----------------------------------------

builder.Services.AddJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();

// --- CORS ----------------------------------------------------------------

builder.Services.AddApiCors(builder.Configuration);

var app = builder.Build();

// --- Migrations --------------------------------------------------------
// Startup migration (db.Database.Migrate()) is intentionally deferred to a
// later task — this scaffold does not apply EF Core migrations on boot.
// When that lands, it belongs here, before the app starts serving requests.

// --- Middleware pipeline ---------------------------------------------------

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
