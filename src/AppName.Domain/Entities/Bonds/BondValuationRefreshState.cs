using System.ComponentModel;

namespace AppName.Domain.Entities.Bonds;

/// <summary>
/// Single-row marker recording how current the cached bond data is and when the
/// next pull may run, used to gate whole-market refreshes.
/// </summary>
public sealed class BondValuationRefreshState(
    long id,
    DateOnly? lastAsOf,
    DateOnly? lastAttemptDate,
    DateTime? nextAttemptNotBefore = null)
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
    /// UTC instant before which the next pull attempt must not start; null when
    /// no attempt is pending.
    /// </summary>
    [DisplayName("Next Attempt Not Before")]
    public DateTime? NextAttemptNotBefore { get; private set; } = nextAttemptNotBefore;

    /// <summary>
    /// Replaces the recorded markers after a pull attempt.
    /// </summary>
    public void Update(DateOnly? lastAsOf, DateOnly? lastAttemptDate, DateTime? nextAttemptNotBefore = null)
    {
        LastAsOf = lastAsOf;
        LastAttemptDate = lastAttemptDate;
        NextAttemptNotBefore = nextAttemptNotBefore;
    }
}
