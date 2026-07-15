import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, isValidPhoneValue, parsePhonePaste } from "./phoneUtils";

describe("formatPhoneDisplay", () => {
  it("formats a valid E.164 number in international form", () => {
    expect(formatPhoneDisplay("+14155552671")).toBe("+1 415 555 2671");
  });

  it("falls back to the raw string when not parseable", () => {
    expect(formatPhoneDisplay("not-a-number")).toBe("not-a-number");
  });

  it("returns an empty string for empty input", () => {
    expect(formatPhoneDisplay("")).toBe("");
  });

  it("normalizes a non-E.164 value to international form when given a default country", () => {
    expect(formatPhoneDisplay("8088888888", "US")).toBe("+1 808 888 8888");
    expect(formatPhoneDisplay("(808) 888-8888", "US")).toBe("+1 808 888 8888");
  });

  it("without a default country, leaves a non-E.164 value as the raw string", () => {
    expect(formatPhoneDisplay("8088888888")).toBe("8088888888");
  });

  it("falls back to the raw string when a value cannot be parsed even with a default country", () => {
    expect(formatPhoneDisplay("not-a-number", "US")).toBe("not-a-number");
  });
});

describe("isValidPhoneValue", () => {
  it("accepts a valid number regardless of nullable", () => {
    expect(isValidPhoneValue("+14155552671", false)).toBe(true);
    expect(isValidPhoneValue("+14155552671", true)).toBe(true);
  });

  it("rejects a malformed non-empty value regardless of nullable", () => {
    expect(isValidPhoneValue("+1234", false)).toBe(false);
    expect(isValidPhoneValue("+1234", true)).toBe(false);
  });

  it("treats empty per the nullable flag", () => {
    expect(isValidPhoneValue(null, true)).toBe(true);
    expect(isValidPhoneValue("", true)).toBe(true);
    expect(isValidPhoneValue(null, false)).toBe(false);
    expect(isValidPhoneValue("", false)).toBe(false);
  });
});

describe("parsePhonePaste", () => {
  it("parses a national-format US string to E.164 (default country US)", () => {
    expect(parsePhonePaste("(415) 555-2671", "US")).toBe("+14155552671");
  });

  it("round-trips an already-E.164 string", () => {
    expect(parsePhonePaste("+14155552671", "US")).toBe("+14155552671");
  });

  it("returns null for an empty/whitespace paste", () => {
    expect(parsePhonePaste("   ", "US")).toBe(null);
  });

  it("returns undefined for an unparseable paste", () => {
    expect(parsePhonePaste("garbage", "US")).toBe(undefined);
  });
});
