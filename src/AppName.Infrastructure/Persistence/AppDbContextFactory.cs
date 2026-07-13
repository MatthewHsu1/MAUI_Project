using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

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
        // Design-time only (used by `dotnet ef`); the running app uses AddInfrastructure's
        // app-supplied connectionString instead of this placeholder.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=appname;Username=postgres;Password=postgres")
            .Options;

        return new AppDbContext(options);
    }
}
