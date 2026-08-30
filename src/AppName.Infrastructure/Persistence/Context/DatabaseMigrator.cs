using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AppName.Infrastructure.Persistence.Context;

/// <summary>
/// Applies pending EF Core migrations from the running host.
/// </summary>
public static class DatabaseMigrator
{
    /// <summary>
    /// Applies any pending migrations when <c>Database:MigrateOnStartup</c> is enabled, and returns
    /// without touching the database otherwise.
    /// </summary>
    public static async Task MigrateDatabaseAsync(
        this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var configuration = services.GetRequiredService<IConfiguration>();

        // Read and parsed by hand rather than through GetValue<bool>: the binder lives in a package
        // this project does not reference, and the value arrives as an environment-variable string.
        if (!bool.TryParse(configuration[SecretKeysConstants.Database.MigrateOnStartup], out var migrateOnStartup)
            || !migrateOnStartup)
        {
            return;
        }

        await using var scope = services.CreateAsyncScope();

        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(DatabaseMigrator).FullName!);

        var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<AppDbContext>>();

        await using var context = await factory.CreateDbContextAsync(cancellationToken);

        var pending = (await context.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();

        if (pending.Count == 0)
        {
            logger.LogInformation("Database schema is up to date; no migrations to apply.");
            return;
        }

        if (logger.IsEnabled(LogLevel.Information))
        {
            logger.LogInformation(
                "Applying {Count} pending migration(s): {Migrations}.", pending.Count, string.Join(", ", pending));
        }

        await context.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("Migrations applied.");
    }
}
