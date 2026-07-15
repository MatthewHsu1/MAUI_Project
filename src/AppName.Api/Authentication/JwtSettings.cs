namespace AppName.Api.Authentication;

/// <summary>
/// Validated JWT bearer settings read from the <c>Jwt</c> configuration section.
/// </summary>
/// <param name="Issuer">
/// Token issuer (<c>Jwt:Issuer</c>).
/// </param>
/// <param name="Audience">
/// Token audience (<c>Jwt:Audience</c>).
/// </param>
/// <param name="Key">
/// Symmetric signing key (<c>Jwt:Key</c>).
/// </param>
public sealed record JwtSettings(string Issuer, string Audience, string Key)
{
    /// <summary>
    /// Reads the <c>Jwt</c> section and validates that issuer, audience, and key
    /// are all present, throwing <see cref="InvalidOperationException"/> otherwise.
    /// </summary>
    public static JwtSettings FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection(SecretKeysConstants.Jwt.Section);
        var issuer = Require(section, SecretKeysConstants.Jwt.Issuer);
        var audience = Require(section, SecretKeysConstants.Jwt.Audience);
        var key = Require(section, SecretKeysConstants.Jwt.Key);
        return new JwtSettings(issuer, audience, key);
    }

    private static string Require(IConfigurationSection section, string name)
    {
        var value = section[name];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                $"{SecretKeysConstants.Jwt.Section}:{name} is not configured.");
        }

        return value;
    }
}
