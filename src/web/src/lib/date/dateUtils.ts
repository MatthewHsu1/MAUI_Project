/**
 * Pure, grid-agnostic helpers for the canonical date representation used by the
 * grid's date cells: an ISO string stored in UTC. Date-only values are pinned to
 * UTC midnight so display (which formats in UTC) never shifts a day.
 */

/**
 * Display string for a cell value.
 * - Date-only (`withTime` false): a floating calendar date, formatted in UTC so a
 *   UTC-midnight value never shifts a day.
 * - Date+time (`withTime` true): a real instant, formatted in the VIEWER'S LOCAL
 *   timezone (both date and time) — the local day can differ from the UTC day.
 * Unparseable input → raw string.
 */
export function formatDateDisplay(iso: string, withTime: boolean): string {
  const d = new Date(iso);

  if (isNaN(d.getTime())) {
    return iso;
  }

  if (!withTime) {
    return d.toLocaleDateString("en-US", { timeZone: "UTC" });
  }

  const date = d.toLocaleDateString("en-US");
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return `${date} ${time}`;
}

/**
 * Empty is governed by `nullable`. Any non-empty value must be parseable by
 * `new Date()` (intentionally lenient — accepts ISO and locale date strings).
 */
export function isValidDateValue(value: string | null, nullable: boolean): boolean {
  if (value == null || value === "") {
    return nullable;
  }

  return !isNaN(new Date(value).getTime());
}

/**
 * Parse a pasted string into a canonical ISO string for a cell.
 *
 * Trimmed first (whitespace-only = empty → null). Returns `undefined` when the
 * value can't be parsed. When `withTime` the parsed instant is kept as-is.
 * Otherwise the result is pinned to UTC midnight of the intended calendar day,
 * upholding the module's UTC-midnight invariant regardless of paste format or
 * the user's timezone: a bare ISO date (`2026-06-20`) or a UTC-designated ISO
 * instant (`2026-06-20T00:00:00.000Z` — this module's own canonical output, as
 * seen when a date-only cell is copied and pasted) parses as UTC midnight, so
 * we read its UTC parts; any other format (e.g. `6/20/2026`) parses as local
 * midnight, so we read its local parts (an offset-designated instant such as
 * `2026-06-20T00:00:00+08:00` is knowingly left on this branch too — its
 * intended calendar day is ambiguous, so we don't special-case it here).
 */
export function parseDatePaste(raw: string, withTime: boolean): string | null | undefined {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  const d = new Date(trimmed);

  if (isNaN(d.getTime())) {
    return undefined;
  }

  if (withTime) {
    return d.toISOString();
  }

  const isUtcSourced = /^\d{4}-\d{2}-\d{2}(T[\d:.]*Z)?$/.test(trimmed);
  const y = isUtcSourced ? d.getUTCFullYear() : d.getFullYear();
  const m = isUtcSourced ? d.getUTCMonth() : d.getMonth();
  const day = isUtcSourced ? d.getUTCDate() : d.getDate();

  return new Date(Date.UTC(y, m, day)).toISOString();
}

/**
 * The calendar day to highlight in the picker, as a local-midnight Date.
 * - Date-only (`withTime` false): the UTC calendar day (floating date).
 * - Date+time (`withTime` true): the LOCAL calendar day of the instant.
 */
export function isoToCalendarDate(iso: string | null, withTime: boolean): Date | undefined {
  if (!iso) {
    return undefined;
  }

  const d = new Date(iso);

  if (isNaN(d.getTime())) {
    return undefined;
  }

  if (withTime) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** The instant's LOCAL time-of-day as an `HH:mm` string for `<input type="time">`. */
export function isoToTimeInput(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const d = new Date(iso);

  if (isNaN(d.getTime())) {
    return "";
  }

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}

/**
 * Combine a picked calendar day (read via its local Y/M/D) and an optional
 * `HH:mm` time into the canonical UTC ISO string.
 * - Date-only (`withTime` false): pin to UTC midnight (floating date).
 * - Date+time (`withTime` true): interpret the picked day + time as the viewer's
 *   LOCAL wall-clock and store the equivalent UTC instant.
 */
export function composeIso(calendarDate: Date, timeInput: string, withTime: boolean): string {
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  const d = calendarDate.getDate();

  let hh = 0;
  let mm = 0;

  if (withTime && timeInput) {
    const [h, min] = timeInput.split(":").map(Number);
    hh = Number.isFinite(h) ? h : 0;
    mm = Number.isFinite(min) ? min : 0;
  }

  if (withTime) {
    return new Date(y, m, d, hh, mm).toISOString();
  }

  return new Date(Date.UTC(y, m, d)).toISOString();
}
