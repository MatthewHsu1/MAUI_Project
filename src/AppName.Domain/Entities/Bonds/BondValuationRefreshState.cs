using System.ComponentModel;

namespace AppName.Domain.Entities.Bonds;

/// <summary>
/// Single-row marker recording when bond data was last pulled, used to gate
/// refreshes to once per Taiwan trading day.
/// </summary>
/// <remarks>
/// Creates a refresh-state marker.
/// </remarks>
public sealed class BondValuationRefreshState(
    long id,
    DateOnly? lastAsOf,
    DateOnly? lastAttemptDate,
    DateTime? retryNotBefore = null)
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
    /// UTC instant before which a released claim must not be retried; null when
    /// no retry is pending.
    /// </summary>
    /// <remarks>
    /// Set only when an attempt failed and gave its day back. It is what lets a
    /// failed refresh be retried within the same day without every request
    /// paying the upstream timeout: the day is claimable again, but not until
    /// this instant has passed. A successful attempt clears it.
    ///
    /// Stored as a UTC <see cref="DateTime"/> rather than a
    /// <see cref="DateTimeOffset"/> because the repository compares it in SQL,
    /// and EF Core's SQLite provider -- which the repository tests run on --
    /// cannot translate a DateTimeOffset comparison.
    /// </remarks>
    [DisplayName("Retry Not Before")]
    public DateTime? RetryNotBefore { get; private set; } = retryNotBefore;

    /// <summary>
    /// Replaces the recorded markers after a pull attempt.
    /// </summary>
    public void Update(DateOnly? lastAsOf, DateOnly? lastAttemptDate, DateTime? retryNotBefore = null)
    {
        LastAsOf = lastAsOf;
        LastAttemptDate = lastAttemptDate;
        RetryNotBefore = retryNotBefore;
    }
}
