import { describe, expect, it } from "vitest";
import { BADGE_SEQUENCE, RADIX_BADGE_SCALES, radixColorByIndex } from "./radixBadgePalette";

describe("radixColorByIndex", () => {
  it("maps an index to the matching sequence entry", () => {
    expect(radixColorByIndex(0)).toBe(BADGE_SEQUENCE[0]);
    expect(radixColorByIndex(3)).toBe(BADGE_SEQUENCE[3]);
  });

  it("wraps around past the end of the sequence", () => {
    expect(radixColorByIndex(BADGE_SEQUENCE.length)).toBe(BADGE_SEQUENCE[0]);
    expect(radixColorByIndex(BADGE_SEQUENCE.length + 2)).toBe(BADGE_SEQUENCE[2]);
  });

  it("handles negative indices", () => {
    expect(radixColorByIndex(-1)).toBe(BADGE_SEQUENCE[BADGE_SEQUENCE.length - 1]);
  });

  it("truncates fractional indices toward zero", () => {
    expect(radixColorByIndex(2.9)).toBe(BADGE_SEQUENCE[2]);
  });

  it("every sequence color is in the importable scale list", () => {
    for (const c of BADGE_SEQUENCE) {
      expect(RADIX_BADGE_SCALES).toContain(c);
    }
  });
});
