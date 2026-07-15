using SecretKeysConstants = AppName.Api.SecretKeysConstants;

namespace AppName.Api.Cors;

/// <summary>
/// Service-collection extensions for wiring up API CORS.
/// </summary>
public static class CorsExtensions
{
    /// <summary>
    /// Registers the API CORS policy, allowing the configured origins from the
    /// <c>Cors:Origins</c> configuration section with credentials.
    /// </summary>
    public static IServiceCollection AddApiCors(
        this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration
            .GetSection(SecretKeysConstants.Cors.OriginsSection)
            .Get<string[]>() ?? [];

        services.AddCors(options =>
        {
            options.AddPolicy(SecretKeysConstants.Cors.PolicyName, policy =>
                policy.WithOrigins(origins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials());
        });

        return services;
    }
}
