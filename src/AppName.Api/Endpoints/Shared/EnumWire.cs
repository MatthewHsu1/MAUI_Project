using System.Text.Json;

namespace AppName.Api.Endpoints.Shared;

/// <summary>
/// The wire spelling of an enum value, and the tolerant parser that reads it back.
/// <para>
/// Every enum this API accepts from a caller travels as a camelCase string, never as
/// the CLR member name and never as an integer. Query-string binding and JSON body
/// binding both need that spelling, and so does the OpenAPI document, so the list
/// lives here once. If the schema advertised one spelling and the parser accepted
/// another, a generated client would send values the server rejects.
/// </para>
/// <para>
/// The request records deliberately bind these values as <see cref="string"/> rather
/// than as the enum itself. Minimal-API query binding parses an enum through the
/// two-argument <c>Enum.TryParse</c> overload, which is case-sensitive and which
/// happily accepts a numeric string, so <c>sortField=conversionValue</c> would fail
/// while <c>sortField=99</c> would succeed and carry an undefined enum value into the
/// query builder. A binder failure also escapes as a raw <c>BadHttpRequestException</c>
/// instead of the RFC 9457 payload the endpoints promise. Parsing here restores both.
/// </para>
/// </summary>
internal static class EnumWire
{
    /// <summary>
    /// The camelCase wire values of <typeparamref name="TEnum"/>, in declaration order.
    /// </summary>
    /// <typeparam name="TEnum">Enum whose members name the allowed wire values.</typeparam>
    public static string[] Names<TEnum>()
        where TEnum : struct, Enum
        => Cache<TEnum>.Names;

    /// <summary>
    /// Reads one enum value from its wire spelling, recording a validation error when the
    /// caller sent something the enum does not name.
    /// </summary>
    /// <typeparam name="TEnum">Enum to read.</typeparam>
    /// <param name="raw">The value as it arrived, or null when the caller omitted it.</param>
    /// <param name="fallback">The value to use when the caller omitted this parameter.</param>
    /// <param name="name">Wire name of the parameter, used as the error key.</param>
    /// <param name="errors">Collects one entry per rejected parameter.</param>
    /// <returns>
    /// The parsed value, or <paramref name="fallback"/> when the value was absent or
    /// rejected. A rejected value also lands in <paramref name="errors"/>, so the caller
    /// tests that dictionary rather than this result to decide whether the request stands.
    /// </returns>
    public static TEnum Parse<TEnum>(
        string? raw,
        TEnum fallback,
        string name,
        Dictionary<string, string[]> errors)
        where TEnum : struct, Enum
    {
        if (string.IsNullOrEmpty(raw))
        {
            return fallback;
        }

        // Enum.TryParse also succeeds for any numeric string, mapping "99" onto an enum
        // value no member declares. Enum.IsDefined is what actually enforces the
        // allow-list; without it an undefined value reaches the sort switch and throws.
        if (Enum.TryParse<TEnum>(raw, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed))
        {
            return parsed;
        }

        errors[name] = [$"{name} must be one of: {string.Join(", ", Names<TEnum>())}."];

        return fallback;
    }

    /// <summary>
    /// Holds the converted names once per closed generic type. A static field on a generic
    /// class is initialised once for each <typeparamref name="TEnum"/>, so reading the list
    /// costs a field load rather than a dictionary probe and an allocation per request.
    /// </summary>
    /// <typeparam name="TEnum">Enum the names belong to.</typeparam>
    private static class Cache<TEnum>
        where TEnum : struct, Enum
    {
        public static readonly string[] Names = Convert();

        private static string[] Convert()
        {
            var members = Enum.GetNames<TEnum>();
            var names = new string[members.Length];

            for (var i = 0; i < members.Length; i++)
            {
                names[i] = JsonNamingPolicy.CamelCase.ConvertName(members[i]);
            }

            return names;
        }
    }
}
