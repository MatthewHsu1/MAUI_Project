using Npgsql;

namespace AppName.Infrastructure.Persistence;

/// <summary>
/// Helpers for normalizing a Npgsql/PostgreSQL connection string before it is handed to EF Core.
/// </summary>
public static class NpgsqlConnectionString
{
    /// <summary>
    /// Resolves a relative <c>Root Certificate</c> path in the supplied connection string into an
    /// absolute path under the application's base directory, so a cert bundled with the deployment
    /// (for example a YugabyteDB CA cert copied to the build output) is found regardless of the
    /// process's current working directory. Absolute paths and empty values are left unchanged.
    /// </summary>
    /// <param name="connectionString">
    /// The connection string to normalize.
    /// </param>
    /// <returns>
    /// The connection string with an absolute <c>Root Certificate</c> path when one was specified.
    /// </returns>
    public static string ResolveRootCertificate(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);

        if (!string.IsNullOrEmpty(builder.RootCertificate) && !Path.IsPathRooted(builder.RootCertificate))
        {
            builder.RootCertificate = Path.Combine(AppContext.BaseDirectory, builder.RootCertificate);
        }

        return builder.ConnectionString;
    }
}
