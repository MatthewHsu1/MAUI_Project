import { describe, expect, it } from "vitest";
import { darkGridTheme, lightGridTheme, themeForAppearance } from "./gridThemes";

describe("themeForAppearance", () => {
  it('returns the dark theme for "dark"', () => {
    expect(themeForAppearance("dark")).toBe(darkGridTheme);
  });

  it('returns the light theme for "light"', () => {
    expect(themeForAppearance("light")).toBe(lightGridTheme);
  });
});

describe("grid themes", () => {
  it("light and dark use distinct cell backgrounds", () => {
    expect(lightGridTheme.bgCell).not.toBe(darkGridTheme.bgCell);
  });
});
