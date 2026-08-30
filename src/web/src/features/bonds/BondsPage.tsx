import { DataGrid } from "@matthewhsu1/datagrid";
import { bondGrid } from "./bondGrid";

/**
 * The convertible-bond valuations page: a read-only grid filling the view. The
 * grid self-loads its first window and persisted column state on mount, so the
 * page is pure layout. `flex: 1; min-height: 0` here only produces a real
 * height because index.css also makes `.radix-themes` (the DOM node
 * RadixThemeProvider renders between `#root` and this page) a flex column —
 * without that rule this div's flex parent isn't actually a flex container,
 * and the whole chain collapses.
 */
export function BondsPage() {
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <DataGrid instance={bondGrid} />
    </div>
  );
}
