import { DataGrid } from "../dataGrid/DataGrid";
import { MockControls } from "./MockControls";
import { testGrid } from "./testGrid";

/**
 * The development test grid page: the mock control bar above a full-height
 * grid.
 *
 * The `flex: 1; min-height: 0` chain matches `BondsPage`, and it only produces a
 * real height because index.css makes `.radix-themes` a flex column. See the
 * comment on `BondsPage` for the full explanation.
 */
export function TestGridPage() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <MockControls />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid instance={testGrid} />
      </div>
    </div>
  );
}
