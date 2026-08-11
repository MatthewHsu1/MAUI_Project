import { describe, expect, it } from "vitest";
import { createEditOverlay } from "./editOverlay";

interface Row {
  id: number;
  name: string;
  note: string;
}

const row: Row = { id: 1, name: "server", note: "kept" };

describe("createEditOverlay", () => {
  it("returns the stored row untouched when nothing is in flight", () => {
    const overlay = createEditOverlay<Row, number>();

    expect(overlay.apply(1, row)).toBe(row);
    expect(overlay.isPending(1)).toBe(false);
  });

  it("shows the optimistic value over the stored one while a save is in flight", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");

    expect(overlay.apply(1, row).name).toBe("typed");
    expect(overlay.apply(1, row).note).toBe("kept");
    expect(overlay.isPending(1)).toBe(true);
  });

  it("leaves the stored row object unmutated", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.apply(1, row);

    expect(row.name).toBe("server");
  });

  it("drops the optimistic value on rollback, so the stored row shows again", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.rollback(1, "name");

    expect(overlay.apply(1, row).name).toBe("server");
    expect(overlay.isPending(1)).toBe(false);
  });

  it("drops the optimistic value on commit too, because the store now holds it", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.commit(1, "name");

    expect(overlay.isPending(1)).toBe(false);
    expect(overlay.apply(1, { ...row, name: "typed" }).name).toBe("typed");
  });

  it("keeps a row pending while a SECOND field of it is still in flight", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.begin(1, "note", "also typed");

    overlay.commit(1, "name");

    expect(overlay.isPending(1)).toBe(true);
    expect(overlay.apply(1, row).note).toBe("also typed");
  });

  it("keeps two rows' edits apart", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "one");
    overlay.begin(2, "name", "two");

    overlay.rollback(1, "name");

    expect(overlay.isPending(1)).toBe(false);
    expect(overlay.isPending(2)).toBe(true);
  });

  it("lets a later edit of the same cell win over an earlier one", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "first");
    overlay.begin(1, "name", "second");

    expect(overlay.apply(1, row).name).toBe("second");
  });

  it("reports every key with an edit in flight, so a reload can spare them", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.begin(2, "name", "typed");
    overlay.commit(2, "name");

    expect(overlay.pendingKeys()).toEqual([1]);
  });

  it("forgets a key entirely once its last field settles", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.commit(1, "name");

    expect(overlay.pendingKeys()).toEqual([]);
  });

  it("drops everything on clear", () => {
    const overlay = createEditOverlay<Row, number>();

    overlay.begin(1, "name", "typed");
    overlay.clear();

    expect(overlay.isPending(1)).toBe(false);
    expect(overlay.apply(1, row).name).toBe("server");
  });
});
