import { describe, expect, it } from "vitest";
import { GridCellKind, type GridCell } from "@glideapps/glide-data-grid";
import { createEditHighlight } from "./useEditHighlight";

const textCell = (data: string): GridCell => ({
  kind: GridCellKind.Text,
  data,
  displayData: data,
  allowOverlay: true,
});

describe("createEditHighlight", () => {
  it("leaves a cell untouched when its key was never edited", () => {
    const h = createEditHighlight(() => 100);
    const cell = textCell("a");

    const result = h.withHighlight("1:name", cell);

    expect(result).toBe(cell);
    expect(result).not.toHaveProperty("lastUpdated");
  });

  it("stamps lastUpdated with the edit time after markEdited", () => {
    const h = createEditHighlight(() => 1234);

    h.markEdited("1:name");
    const result = h.withHighlight("1:name", textCell("a"));

    expect(result.lastUpdated).toBe(1234);
  });

  it("only highlights the edited key, not its neighbours", () => {
    const h = createEditHighlight(() => 50);

    h.markEdited("1:name");

    expect(h.withHighlight("1:name", textCell("a")).lastUpdated).toBe(50);
    expect(h.withHighlight("2:name", textCell("b")).lastUpdated).toBeUndefined();
  });

  it("advances lastUpdated to the latest edit time when a key is re-edited", () => {
    let clock = 10;
    const h = createEditHighlight(() => clock);

    h.markEdited("1:name");
    clock = 999;
    h.markEdited("1:name");

    expect(h.withHighlight("1:name", textCell("a")).lastUpdated).toBe(999);
  });
});
