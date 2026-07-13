using System.Text;
using AppName.Api.Endpoints;
using AppName.Application;
using AppName.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// --- Composition -----------------------------------------------------------

var connectionString = builder.Configuration.GetConnectionString("AppDb");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'ConnectionStrings:AppDb' is not configured. " +
        "Set it in appsettings.{Environment}.json, user-secrets, or the " +
        "ConnectionStrings__AppDb environment variable.");
}

builder.Services.AddApplication().AddInfrastructure(connectionString);

// --- OpenAPI -----------------------------------------------------------

builder.Services.AddOpenApi();

// --- Auth (JWT bearer, dev stub) ----------------------------------------

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtIssuer = jwtSection["Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
var jwtAudience = jwtSection["Audience"] ?? throw new InvalidOperationException("Jwt:Audience is not configured.");
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// --- CORS ----------------------------------------------------------------

const string CorsPolicyName = "ClientOrigins";
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

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

app.UseCors(CorsPolicyName);
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");
api.MapAuthEndpoints();
api.MapBondEndpoints();

app.Run();
