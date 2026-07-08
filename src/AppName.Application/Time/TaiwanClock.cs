namespace AppName.Application.Time;

/// <summary>
/// Resolves the current Taiwan trading-calendar date from a <see cref="TimeProvider"/>.
/// </summary>
public static class TaiwanClock
{
    private static readonly TimeZoneInfo Taipei = TimeZoneInfo.FindSystemTimeZoneById("Asia/Taipei");

    /// <summary>
    /// Returns today's date in the Asia/Taipei time zone.
    /// </summary>
    public static DateOnly Today(TimeProvider timeProvider) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Taipei).DateTime);
}
