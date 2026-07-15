import {
  formatPhoneNumberIntl,
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input";

/**
 * Format a phone value for canvas display, in international form.
 *
 * Already-E.164 values format directly. For legacy values stored in another
 * format (bare digits, national format), pass `defaultCountry` so the value can
 * be parsed and normalized (e.g. "8088888888" → "+1 808 888 8888"). Falls back
 * to the raw string when it can't be parsed.
 */
export function formatPhoneDisplay(value: string, defaultCountry?: Country): string {
  const intl = formatPhoneNumberIntl(value);

  if (intl) {
    return intl;
  }

  if (defaultCountry) {
    try {
      const parsed = parsePhoneNumber(value, defaultCountry);

      if (parsed) {
        return parsed.formatInternational();
      }
    } catch {
      // fall through to the raw value
    }
  }

  return value;
}

/**
 * True when a stored value is acceptable to commit. Empty (null/"") is governed
 * by `nullable`; any non-empty value must be a valid phone number.
 */
export function isValidPhoneValue(value: string | null, nullable: boolean): boolean {
  if (value == null || value === "") {
    return nullable;
  }

  return isValidPhoneNumber(value);
}

/**
 * Parse a pasted string. The input is trimmed first, so whitespace-only counts
 * as empty. Returns the E.164 string on success, `null` for an empty paste, or
 * `undefined` when the value cannot be parsed to a valid number.
 */
export function parsePhonePaste(raw: string, defaultCountry: Country): string | null | undefined {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  try {
    const parsed = parsePhoneNumber(trimmed, defaultCountry);

    if (parsed && parsed.isValid()) {
      return parsed.number;
    }
  } catch {
    // fall through to undefined
  }

  return undefined;
}
