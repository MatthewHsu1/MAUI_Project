import { describe, expect, it } from "vitest";
import { radixThemeConfig } from "./radixTheme";

describe("radixThemeConfig", () => {
  it("uses the iris accent (nearest hue to the grid accent #4F46E5)", () => {
    expect(radixThemeConfig.accentColor).toBe("iris");
  });

  it("uses the slate gray (matches the grid cool-gray tints)", () => {
    expect(radixThemeConfig.grayColor).toBe("slate");
  });

  it("pins radius and scaling so the look is stable", () => {
    expect(radixThemeConfig.radius).toBe("medium");
    expect(radixThemeConfig.scaling).toBe("100%");
  });
});
