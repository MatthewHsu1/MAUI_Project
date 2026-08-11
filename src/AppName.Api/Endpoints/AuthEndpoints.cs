using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json.Serialization;
using AppName.Api.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.IdentityModel.Tokens;

namespace AppName.Api.Endpoints;

/// <summary>
/// Local development authentication endpoints.
/// </summary>
public static class AuthEndpoints
{
    /// <summary>
    /// Maps the dev token-minting endpoint under the given route group.
    /// </summary>
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder group)
    {
        // DEV STUB ONLY: mints a JWT for a hardcoded placeholder user so the React
        // and MAUI clients can obtain a bearer token while developing locally.
        // This must be replaced by a real identity provider (e.g. OIDC/Entra ID)
        // before any non-local deployment — there is no credential check here.
        group.MapPost("/auth/token", Ok<TokenResponse> (IConfiguration config) =>
        {
            var jwt = JwtSettings.FromConfiguration(config);

            var signingKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwt.Key));
            
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var expires = DateTime.UtcNow.AddHours(1);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, "dev-user"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };

            var token = new JwtSecurityToken(
                issuer: jwt.Issuer,
                audience: jwt.Audience,
                claims: claims,
                expires: expires,
                signingCredentials: credentials);

            var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

            return TypedResults.Ok(new TokenResponse(accessToken, (int)TimeSpan.FromHours(1).TotalSeconds));
        })
        .AllowAnonymous()
        .WithName("MintDevToken");

        return group;
    }

    /// <summary>
    /// Response body for the dev token endpoint (OAuth2-style snake_case field
    /// names, matching what most bearer-token clients expect).
    /// </summary>
    /// <param name="AccessToken">The minted bearer token.</param>
    /// <param name="ExpiresIn">Token lifetime in seconds.</param>
    internal sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
