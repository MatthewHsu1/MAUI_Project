using AppName.Application.Time;

namespace AppName.Application.Tests.Time;

public class TaiwanClockTests
{
    // Taipei is UTC+8. Each instant below is written as the UTC that produces the
    // Taipei wall-clock time named in the comment.
    private static readonly DateTimeOffset WedBeforeClose = new(2026, 7, 1, 4, 0, 0, TimeSpan.Zero);   // Wed 12:00
    private static readonly DateTimeOffset WedAfterClose = new(2026, 7, 1, 8, 0, 0, TimeSpan.Zero);    // Wed 16:00
    private static readonly DateTimeOffset WedLateEvening = new(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);  // Wed 20:00
    private static readonly DateTimeOffset SatAfterClose = new(2026, 7, 4, 8, 0, 0, TimeSpan.Zero);    // Sat 16:00
    private static readonly DateTimeOffset SunAfterClose = new(2026, 7, 5, 8, 0, 0, TimeSpan.Zero);    // Sun 16:00
    private static readonly DateTimeOffset MonBeforeClose = new(2026, 7, 6, 4, 0, 0, TimeSpan.Zero);   // Mon 12:00

    [Fact]
    public void ExpectedDataDate_ReturnsToday_WhenTheCloseHasBeenPublished()
    {
        var clock = new FixedTimeProvider(WedAfterClose);

        var expected = TaiwanClock.ExpectedDataDate(clock);

        Assert.Equal(new DateOnly(2026, 7, 1), expected);
    }

    [Fact]
    public void ExpectedDataDate_ReturnsThePreviousDay_WhenTheCloseIsNotPublishedYet()
    {
        var clock = new FixedTimeProvider(WedBeforeClose);

        var expected = TaiwanClock.ExpectedDataDate(clock);

        // Chasing today's date before it can exist is what left the gate open
        // every morning.
        Assert.Equal(new DateOnly(2026, 6, 30), expected);
    }

    [Fact]
    public void ExpectedDataDate_ReturnsFriday_OnASaturday()
    {
        var clock = new FixedTimeProvider(SatAfterClose);

        var expected = TaiwanClock.ExpectedDataDate(clock);

        // A weekend never publishes a close, so a Saturday date would sit forever
        // ahead of the newest data and re-pull the whole market all weekend.
        Assert.Equal(new DateOnly(2026, 7, 3), expected);
    }

    [Fact]
    public void ExpectedDataDate_ReturnsFriday_OnASunday()
    {
        var clock = new FixedTimeProvider(SunAfterClose);

        var expected = TaiwanClock.ExpectedDataDate(clock);

        Assert.Equal(new DateOnly(2026, 7, 3), expected);
    }

    [Fact]
    public void ExpectedDataDate_ReturnsFriday_OnAMondayMorning()
    {
        var clock = new FixedTimeProvider(MonBeforeClose);

        var expected = TaiwanClock.ExpectedDataDate(clock);

        Assert.Equal(new DateOnly(2026, 7, 3), expected);
    }

    [Fact]
    public void IsClosePublishGraceOpen_ReturnsFalse_BeforeThePublishTime()
    {
        var clock = new FixedTimeProvider(WedBeforeClose);

        Assert.False(TaiwanClock.IsClosePublishGraceOpen(clock));
    }

    [Fact]
    public void IsClosePublishGraceOpen_ReturnsTrue_ShortlyAfterThePublishTime()
    {
        var clock = new FixedTimeProvider(WedAfterClose);

        Assert.True(TaiwanClock.IsClosePublishGraceOpen(clock));
    }

    [Fact]
    public void IsClosePublishGraceOpen_ReturnsFalse_LateInTheEvening()
    {
        var clock = new FixedTimeProvider(WedLateEvening);

        // By now a day with no close of its own was not a trading day, and the
        // refresh must stop retrying until tomorrow.
        Assert.False(TaiwanClock.IsClosePublishGraceOpen(clock));
    }

    [Fact]
    public void Today_ReturnsTheTaipeiDate()
    {
        var clock = new FixedTimeProvider(WedLateEvening);

        Assert.Equal(new DateOnly(2026, 7, 1), TaiwanClock.Today(clock));
    }
}
