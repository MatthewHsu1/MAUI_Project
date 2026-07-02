using System.ComponentModel;

namespace AppName.Domain.Entities;

/// <summary>
/// Single-row marker recording when bond data was last pulled, used to gate
/// refreshes to once per Taiwan trading day.
/// </summary>
/// <remarks>
/// Creates a refresh-state marker.
/// </remarks>
public sealed class BondValuationRefreshState(long id, DateOnly? lastAsOf, DateOnly? lastAttemptDate)
{
    /// <summary>
    /// The fixed primary-key value of the single marker row.
    /// </summary>
    public const long SingletonId = 1;

    /// <summary>
    /// Primary key; always <see cref="SingletonId"/>.
    /// </summary>
    [DisplayName("Id")]
    public long Id { get; } = id;

    /// <summary>
    /// Max quote as-of date across the last successful pull; null before any pull.
    /// </summary>
    [DisplayName("Last As Of")]
    public DateOnly? LastAsOf { get; private set; } = lastAsOf;

    /// <summary>
    /// Taiwan calendar date of the last pull attempt; null before any pull.
    /// </summary>
    [DisplayName("Last Attempt Date")]
    public DateOnly? LastAttemptDate { get; private set; } = lastAttemptDate;

    /// <summary>
    /// Replaces the recorded markers after a pull attempt.
    /// </summary>
    public void Update(DateOnly? lastAsOf, DateOnly? lastAttemptDate)
    {
        LastAsOf = lastAsOf;
        LastAttemptDate = lastAttemptDate;
    }
}
