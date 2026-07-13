using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AppName.Infrastructure.Persistence;

/// <summary>
/// Creates an <see cref="AppDbContext"/> at design time so the EF Core CLI can generate and apply
/// migrations without the MAUI head project (which cannot host the EF tooling).
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    /// <summary>
    /// Name of the connection string read from configuration (appsettings.json or user secrets).
    /// </summary>
    private const string ConnectionStringName = "AppDb";

    /// <inheritdoc/>
    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
            .AddUserSecrets<AppDbContextFactory>(optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString(ConnectionStringName);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"The connection string '{ConnectionStringName}' is missing or empty. " +
                $"Set it with: dotnet user-secrets set \"ConnectionStrings:{ConnectionStringName}\" \"<value>\"");
        }

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
