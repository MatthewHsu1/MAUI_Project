import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  composeIso,
  formatDateDisplay,
  isoToCalendarDate,
  isoToTimeInput,
  isValidDateValue,
  parseDatePaste,
} from "./dateUtils";

describe("formatDateDisplay", () => {
  it("formats date-only in UTC (not a day early)", () => {
    expect(formatDateDisplay("2026-06-20T00:00:00Z", false)).toBe("6/20/2026");
  });

  it("formats date+time in the local zone (round-trips a locally-composed instant)", () => {
    const iso = composeIso(new Date(2026, 5, 20), "14:30", true);
    expect(formatDateDisplay(iso, true)).toBe("6/20/2026 2:30 PM");
  });

  it("falls back to the raw string when unparseable", () => {
    expect(formatDateDisplay("not-a-date", false)).toBe("not-a-date");
  });
});

describe("isValidDateValue", () => {
  it("accepts a valid ISO regardless of nullable", () => {
    expect(isValidDateValue("2026-06-20T00:00:00Z", false)).toBe(true);
    expect(isValidDateValue("2026-06-20T00:00:00Z", true)).toBe(true);
  });

  it("rejects a malformed non-empty value regardless of nullable", () => {
    expect(isValidDateValue("garbage", false)).toBe(false);
    expect(isValidDateValue("garbage", true)).toBe(false);
  });

  it("treats empty per the nullable flag", () => {
    expect(isValidDateValue(null, true)).toBe(true);
    expect(isValidDateValue("", true)).toBe(true);
    expect(isValidDateValue(null, false)).toBe(false);
  });
});

describe("parseDatePaste", () => {
  it("parses a bare ISO date as UTC midnight (date-only)", () => {
    expect(parseDatePaste("2026-06-20", false)).toBe("2026-06-20T00:00:00.000Z");
  });

  it("pins a locale-format date to UTC midnight of the intended day (date-only)", () => {
    expect(parseDatePaste("6/20/2026", false)).toBe("2026-06-20T00:00:00.000Z");
  });

  it("preserves the time component when withTime", () => {
    expect(parseDatePaste("2026-06-20T14:30:00Z", true)).toBe("2026-06-20T14:30:00.000Z");
  });

  it("returns null for an empty/whitespace paste", () => {
    expect(parseDatePaste("   ", false)).toBe(null);
  });

  it("returns undefined for an unparseable paste", () => {
    expect(parseDatePaste("garbage", false)).toBe(undefined);
  });
});

describe("parseDatePaste — date-only paste in a negative-UTC-offset timezone", () => {
  // Pinned to a negative-offset zone so this suite is deterministic regardless of
  // the machine running it. This is exactly the class of zone the reported bug
  // shifts a day in: a UTC-designated ISO instant (the module's own canonical
  // output, e.g. from copying a date-only cell) fell through to the LOCAL
  // components branch and read one calendar day early.
  beforeAll(() => {
    vi.stubEnv("TZ", "America/New_York");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("parses a full UTC-designated ISO instant as UTC midnight, not a day early", () => {
    expect(parseDatePaste("2026-06-20T00:00:00.000Z", false)).toBe("2026-06-20T00:00:00.000Z");
  });

  it("still parses a bare ISO date as UTC midnight", () => {
    expect(parseDatePaste("2026-06-20", false)).toBe("2026-06-20T00:00:00.000Z");
  });

  it("still pins a locale-format date to UTC midnight of the intended local day", () => {
    expect(parseDatePaste("6/20/2026", false)).toBe("2026-06-20T00:00:00.000Z");
  });
});

describe("isoToCalendarDate / isoToTimeInput", () => {
  it("reads the UTC calendar day for a date-only value", () => {
    const d = isoToCalendarDate("2026-06-20T23:00:00Z", false);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5); // June (0-based)
    expect(d?.getDate()).toBe(20);
  });

  it("reads the local calendar day for a date+time instant", () => {
    const iso = composeIso(new Date(2026, 5, 20), "23:30", true);
    const d = isoToCalendarDate(iso, true);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(20);
  });

  it("returns undefined for null/invalid", () => {
    expect(isoToCalendarDate(null, false)).toBeUndefined();
    expect(isoToCalendarDate("garbage", true)).toBeUndefined();
  });

  it("reads the local time as HH:mm", () => {
    const iso = composeIso(new Date(2026, 5, 20), "09:05", true);
    expect(isoToTimeInput(iso)).toBe("09:05");
  });

  it("returns empty string for null or invalid time input", () => {
    expect(isoToTimeInput(null)).toBe("");
    expect(isoToTimeInput("garbage")).toBe("");
  });
});

describe("composeIso", () => {
  it("date-only composes to UTC midnight of the picked day", () => {
    const picked = new Date(2026, 5, 20); // local June 20
    expect(composeIso(picked, "", false)).toBe("2026-06-20T00:00:00.000Z");
  });

  it("withTime interprets the picked day + HH:mm as local and round-trips locally", () => {
    const picked = new Date(2026, 5, 20);
    const iso = composeIso(picked, "14:30", true);
    expect(isoToTimeInput(iso)).toBe("14:30");
    const back = isoToCalendarDate(iso, true);
    expect(back?.getDate()).toBe(20);
    expect(back?.getMonth()).toBe(5);
  });

  it("withTime applies the local→UTC offset (not a UTC passthrough)", () => {
    // composeIso interprets the picked day + time as LOCAL wall-clock, so the
    // stored UTC time is local + getTimezoneOffset(). This assertion holds in any
    // zone (trivially in UTC), and actively fails if compose ever reverts to a
    // UTC passthrough while running in a non-UTC zone.
    const offsetMin = new Date(2026, 5, 20, 14, 30).getTimezoneOffset();
    const iso = composeIso(new Date(2026, 5, 20), "14:30", true);
    const d = new Date(iso);
    const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    expect(utcMinutes).toBe((14 * 60 + 30 + offsetMin + 1440) % 1440);
  });
});
