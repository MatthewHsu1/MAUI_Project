using System.ComponentModel;

namespace AppName.Domain.ValueObjects.Bonds;

/// <summary>
/// One caller's bid to run the next whole-market bond refresh, carrying every
/// value the claim predicate compares the stored marker against.
/// </summary>
public sealed record BondValuationRefreshClaim
{
    /// <summary>
    /// The most recent Taiwan date whose closing quotes should already exist.
    /// Cached data older than this is stale; data on or after it is current.
    /// </summary>
    [DisplayName("Expected Data Date")]
    public required DateOnly ExpectedDataDate { get; init; }

    /// <summary>
    /// The Taiwan calendar date of this attempt, stamped on a won claim.
    /// </summary>
    [DisplayName("Taiwan Today")]
    public required DateOnly TaiwanToday { get; init; }

    /// <summary>
    /// True while a missing close for <see cref="ExpectedDataDate"/> is still
    /// plausibly late rather than proof that the day was not a trading day.
    /// </summary>
    [DisplayName("Is Close Publish Grace Open")]
    public required bool IsClosePublishGraceOpen { get; init; }

    /// <summary>
    /// The UTC instant the claim is made, compared against the stored
    /// next-attempt time.
    /// </summary>
    [DisplayName("Now")]
    public required DateTime Now { get; init; }

    /// <summary>
    /// The UTC instant a later caller may claim again, stamped by a won claim.
    /// </summary>
    [DisplayName("Next Attempt Not Before")]
    public required DateTime NextAttemptNotBefore { get; init; }
}
