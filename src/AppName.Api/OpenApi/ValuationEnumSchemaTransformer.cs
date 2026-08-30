using System.Text.Json.Nodes;
using AppName.Api.Endpoints.Bonds;
using AppName.Api.Endpoints.Shared;
using AppName.Domain.Querying;
using AppName.Domain.ValueObjects.Valuations;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace AppName.Api.OpenApi;

/// <summary>
/// Restores the allowed values onto the valuation sort and filter-operator parameters,
/// which bind as <see cref="string"/> rather than as their enums.
/// <para>
/// The enums cannot be the bound type. Minimal-API query binding parses an enum with the
/// case-sensitive two-argument <c>Enum.TryParse</c>, which rejects the camelCase values
/// this API's wire contract specifies and accepts a numeric string that names no member.
/// <see cref="EnumWire"/> parses the string instead. That fixes the server but empties the
/// schema: without this transformer the OpenAPI document describes <c>sortField</c> as a
/// bare string, <c>openapi-typescript</c> generates <c>string</c> instead of a union, and
/// the client loses the compile-time allow-list the enum was chosen to give it.
/// </para>
/// <para>
/// The values come from the same <see cref="EnumWire"/> list the parser reads, so the
/// document and the server cannot drift. Do not hand-write the values here: a schema that
/// advertises a value the parser rejects is worse than no schema at all.
/// </para>
/// </summary>
public sealed class ValuationEnumSchemaTransformer : IOpenApiSchemaTransformer
{
    /// <summary>
    /// Body properties that carry an enum value, keyed by the declaring type and the JSON
    /// property name. The declaring type is part of the key because names like
    /// <c>field</c> and <c>operator</c> are generic enough that a future DTO could reuse
    /// one and inherit these values by accident.
    /// </summary>
    private static readonly Dictionary<(Type Declaring, string Property), string[]> BodyValues = new()
    {
        [(typeof(ValuationSortBody), "field")] = EnumWire.Names<ValuationSortField>(),
        [(typeof(ValuationSortBody), "direction")] = EnumWire.Names<SortDirection>(),
        [(typeof(ValuationSortBody), "nulls")] = EnumWire.Names<NullPlacement>(),
        [(typeof(ValuationFilterNode), "operator")] = EnumWire.Names<LogicalOperator>(),
    };

    /// <summary>
    /// Query parameters that carry an enum value, keyed by their wire name. A flattened
    /// <c>[AsParameters]</c> property exposes no declaring type here, so the name is the
    /// only key available. These three names appear on the valuation endpoints alone.
    /// </summary>
    private static readonly Dictionary<string, string[]> QueryValues = new(StringComparer.Ordinal)
    {
        ["sortField"] = EnumWire.Names<ValuationSortField>(),
        ["sortDir"] = EnumWire.Names<SortDirection>(),
        ["nulls"] = EnumWire.Names<NullPlacement>(),
    };

    /// <inheritdoc/>
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        string[]? values = null;

        // A body property reports both a JsonPropertyInfo and the enclosing handler
        // parameter, so the property has to be tested first. A query parameter reports
        // only the parameter, and its name is already the camelCase wire name.
        if (context.JsonPropertyInfo is { } property)
        {
            BodyValues.TryGetValue((property.DeclaringType, property.Name), out values);
        }
        else if (context.ParameterDescription?.Name is { } parameterName)
        {
            QueryValues.TryGetValue(parameterName, out values);
        }

        if (values is null)
        {
            return Task.CompletedTask;
        }

        var allowed = new List<JsonNode?>(values.Length + 1);

        foreach (var value in values)
        {
            allowed.Add(JsonValue.Create(value));
        }

        // An optional body property is typed "null or string". Omitting null from the enum
        // would make the schema contradict itself and reject a value its own type allows.
        if (schema.Type is { } type && type.HasFlag(JsonSchemaType.Null))
        {
            allowed.Add(null);
        }

        // Microsoft.OpenApi declares the member list as IList<JsonNode>, but a JSON null
        // enum member has no JsonNode representation other than a null element, so the
        // element type has to be widened here and the mismatch suppressed on assignment.
        schema.Enum = allowed!;

        return Task.CompletedTask;
    }
}
