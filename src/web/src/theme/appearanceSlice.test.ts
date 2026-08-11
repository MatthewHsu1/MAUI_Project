import { describe, expect, it } from "vitest";
import reducer, { setAppearance, type AppearanceState } from "./appearanceSlice";

const initial: AppearanceState = { appearance: "light" };

describe("appearanceSlice", () => {
  it("defaults to light", () => {
    expect(reducer(undefined, { type: "@@INIT" })).toEqual({ appearance: "light" });
  });

  it('setAppearance("dark") switches to dark', () => {
    expect(reducer(initial, setAppearance("dark"))).toEqual({ appearance: "dark" });
  });

  it('setAppearance("light") switches back to light', () => {
    expect(reducer({ appearance: "dark" }, setAppearance("light"))).toEqual({
      appearance: "light",
    });
  });
});
