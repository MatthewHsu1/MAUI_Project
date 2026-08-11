using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace AppName.Api.OpenApi;

/// <summary>
/// Narrows the OpenAPI schema for <see cref="decimal"/> and <see cref="Nullable{T}"/> of
/// <see cref="decimal"/> from "number or string" down to "number" (or "number or null").
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
/// </summary>
public sealed class DecimalSchemaTransformer : IOpenApiSchemaTransformer
{
    /// <inheritdoc/>
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;

        if (type != typeof(decimal) && type != typeof(decimal?))
        {
            return Task.CompletedTask;
        }

        schema.Type = type == typeof(decimal?)
            ? JsonSchemaType.Number | JsonSchemaType.Null
            : JsonSchemaType.Number;

        schema.Pattern = null;

        return Task.CompletedTask;
    }
}
