namespace AppName.Api;

/// <summary>
/// Centralized configuration/secret key names used by the API host.
/// </summary>
public static class SecretKeysConstants
{
    /// <summary>
    /// JWT bearer configuration keys (section <c>Jwt</c>).
    /// </summary>
    public static class Jwt
    {
        /// <summary>
        /// Configuration section holding the JWT settings.
        /// </summary>
        public const string Section = "Jwt";

        /// <summary>
        /// Token issuer key (<c>Jwt:Issuer</c>).
        /// </summary>
        public const string Issuer = "Issuer";

        /// <summary>
        /// Token audience key (<c>Jwt:Audience</c>).
        /// </summary>
        public const string Audience = "Audience";

        /// <summary>
        /// Signing key (<c>Jwt:Key</c>).
        /// </summary>
        public const string Key = "Key";
    }

    /// <summary>
    /// CORS configuration keys and the client-origins policy name.
    /// </summary>
    public static class Cors
    {
        /// <summary>
        /// Configuration key for the allowed client origins (<c>Cors:Origins</c>).
        /// </summary>
        public const string OriginsSection = "Cors:Origins";

        /// <summary>
        /// Name of the CORS policy applied to client origins.
        /// </summary>
        public const string PolicyName = "ClientOrigins";
    }
}
