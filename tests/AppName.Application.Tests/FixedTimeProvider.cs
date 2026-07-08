namespace AppName.Application.Tests;

/// <summary>
/// Deterministic <see cref="TimeProvider"/> returning a fixed UTC instant.
/// </summary>
public sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => utcNow;
}
