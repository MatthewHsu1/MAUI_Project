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
        // app-data dbPath (FileSystem.AppDataDirectory) instead of this local file.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=app.db")
            .Options;

        return new AppDbContext(options);
    }
}
