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
    /// <inheritdoc/>
    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
            .AddUserSecrets<AppDbContextFactory>(optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString(SecretKeysConstants.ConnectionStrings.AppDb);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"The connection string '{SecretKeysConstants.ConnectionStrings.AppDb}' is missing or empty. " +
                $"Set it with: dotnet user-secrets set \"ConnectionStrings:{SecretKeysConstants.ConnectionStrings.AppDb}\" \"<value>\"");
        }

        connectionString = NpgsqlConnectionString.ResolveRootCertificate(connectionString);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
