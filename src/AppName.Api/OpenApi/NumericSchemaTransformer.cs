using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace AppName.Api.OpenApi;

/// <summary>
/// Narrows the OpenAPI schema for <see cref="decimal"/> and <see cref="int"/>, and their
/// <see cref="Nullable{T}"/> forms, from "number or string" down to a plain number.
/// By default, .NET's OpenAPI document generator describes every <c>decimal</c> as a
/// union of <c>number</c> and <c>string</c> plus a validation <c>pattern</c>, because a
/// decimal-typed property can in principle be serialized either way depending on
/// <c>JsonSerializerOptions</c>. This API never sets
/// <see cref="System.Text.Json.Serialization.JsonNumberHandling.WriteAsString"/>, so
/// <c>System.Text.Json</c> always emits decimals as plain JSON numbers. Leaving the
/// string member in the schema is not defensive, it is inaccurate, and it forces
/// generated TypeScript clients to add a <c>number | string</c> coercion layer for values
/// that can never actually arrive as strings. Do not remove this transformer as dead code:
/// removing it silently reintroduces that phantom string arm into every generated client.
/// <para>
/// <c>int</c> is covered for the same reason and by the same rule. The generator gives it
/// the identical <c>["integer", "string"]</c> union, which the valuation endpoints made
/// visible: <c>offset</c>, <c>limit</c> and the count response would otherwise generate as
/// <c>number | string</c>. The <c>decimal</c> case simply reached the document first.
/// </para>
/// </summary>
public sealed class NumericSchemaTransformer : IOpenApiSchemaTransformer
{
    /// <inheritdoc/>
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;

        JsonSchemaType number;

        if (type == typeof(decimal) || type == typeof(decimal?))
        {
            number = JsonSchemaType.Number;
        }
        else if (type == typeof(int) || type == typeof(int?))
        {
            number = JsonSchemaType.Integer;
        }
        else
        {
            return Task.CompletedTask;
        }

        // The null arm is carried over rather than derived from the CLR type. The generator
        // adds it to a nullable body property but not to a nullable query parameter, which
        // is already absent when omitted, so copying it keeps both cases accurate.
        var nullArm = schema.Type is { } existing ? existing & JsonSchemaType.Null : default;

        schema.Type = number | nullArm;

        schema.Pattern = null;

        return Task.CompletedTask;
    }
}
