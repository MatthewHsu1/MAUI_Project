namespace AppName.Application.Time;

/// <summary>
/// Resolves the current Taiwan trading-calendar date from a <see cref="TimeProvider"/>.
/// </summary>
public static class TaiwanClock
{
    private static readonly TimeZoneInfo Taipei = TimeZoneInfo.FindSystemTimeZoneById("Asia/Taipei");

    /// <summary>
    /// Taipei local time by which the exchange has published the day's close.
    /// </summary>
    private static readonly TimeOnly ClosingQuotesPublishedBy = new(15, 0);

    /// <summary>
    /// Taipei local time after which a day that has still not produced its own
    /// close is treated as a non-trading day rather than a late publication.
    /// </summary>
    private static readonly TimeOnly ClosePublishGraceEndsAt = new(18, 0);

    /// <summary>
    /// Returns today's date in the Asia/Taipei time zone.
    /// </summary>
    public static DateOnly Today(TimeProvider timeProvider) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Taipei).DateTime);

    /// <summary>
    /// Returns the most recent Taiwan date whose closing quotes should already
    /// exist, which is the date cached market data has to carry to be current.
    /// </summary>
    /// <param name="timeProvider">Supplies the current instant.</param>
    public static DateOnly ExpectedDataDate(TimeProvider timeProvider)
    {
        var taipeiNow = TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Taipei).DateTime;

        // Before the exchange publishes, today's close does not exist yet, so the
        // newest data anyone can hold is the previous trading day's. Chasing today
        // instead would leave the gate open every morning.
        var date = DateOnly.FromDateTime(taipeiNow);
        if (TimeOnly.FromDateTime(taipeiNow) < ClosingQuotesPublishedBy)
        {
            date = date.AddDays(-1);
        }

        // A weekend never produces a close. Without this the newest data would sit
        // permanently behind the requested date and the gate would re-pull the whole
        // market every interval, all weekend.
        while (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            date = date.AddDays(-1);
        }

        return date;
    }

    /// <summary>
    /// Returns true while a missing close for <see cref="ExpectedDataDate"/> is
    /// still plausibly late rather than proof of a non-trading day.
    /// </summary>
    /// <param name="timeProvider">Supplies the current instant.</param>
    public static bool IsClosePublishGraceOpen(TimeProvider timeProvider)
    {
        // Taiwan public holidays cannot be derived from the calendar, so they are
        // recognised only by their effect: the day passes without publishing a
        // close. This window bounds how long a refresh keeps retrying before
        // drawing that conclusion and waiting for the next day.
        var taipeiTime = TimeOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Taipei).DateTime);

        return taipeiTime >= ClosingQuotesPublishedBy && taipeiTime < ClosePublishGraceEndsAt;
    }
}
