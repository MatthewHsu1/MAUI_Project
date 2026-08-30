namespace AppName.Infrastructure;

/// <summary>
/// Centralized configuration/secret key names used to read values from
/// <c>IConfiguration</c> (appsettings, user-secrets, environment variables).
/// </summary>
public static class SecretKeysConstants
{
    /// <summary>
    /// Named connection strings read from the <c>ConnectionStrings</c> section.
    /// </summary>
    public static class ConnectionStrings
    {
        /// <summary>
        /// Application database connection string
        /// (<c>ConnectionStrings:AppDb</c>, or the
        /// <c>ConnectionStrings__AppDb</c> environment variable).
        /// </summary>
        public const string AppDb = "AppDb";
    }

    /// <summary>
    /// Database host behaviour keys (section <c>Database</c>).
    /// </summary>
    public static class Database
    {
        /// <summary>
        /// Whether the host applies pending EF Core migrations on start-up
        /// (<c>Database:MigrateOnStartup</c>, or the
        /// <c>Database__MigrateOnStartup</c> environment variable).
        /// </summary>
        public const string MigrateOnStartup = "Database:MigrateOnStartup";
    }
}
