import { Button, Callout, Flex, Spinner } from "@radix-ui/themes";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The bar sits flush against the grid, so it drops the Callout radius and keeps
 * only the bottom edge of the ring. `--accent-a*` follows the `color` prop, so
 * one style serves both the red and the gray bar.
 */
function StatusCallout({
  color,
  role,
  icon,
  children,
}: {
  color: "red" | "gray";
  role: "alert" | "status";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Callout.Root
      role={role}
      color={color}
      size="1"
      variant="soft"
      style={{ borderRadius: 0, borderBottom: "1px solid var(--accent-a6)" }}
    >
      <Callout.Icon>{icon}</Callout.Icon>
      {children}
    </Callout.Root>
  );
}

/**
 * Where a grid failure becomes visible.
 *
 * Before this existed, a failed window left the grid drawing loading cells for
 * ever, with no way to tell "still loading" from "gave up".
 *
 * A load stays silent while the grid HAS rows, because the loading cells
 * already say it. `rowCount` is what tells the two apart: on the first load the
 * total is not known yet, so there are no cells and no loading cells either,
 * and a silent bar over an empty canvas reads as a grid that finished and found
 * nothing. That case gets a line of its own.
 *
 * `stale` gets a line for the opposite reason. The grid then holds a full set of
 * rows and draws no loading cell at all, because every one of those rows belongs
 * to the state the user has just left. Nothing on the canvas says so.
 */
export function GridStatusBar({
  status,
  error,
  rowCount,
  stale,
  onRetry,
  onDismissError,
}: {
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Rows the grid is currently drawing. Zero means there are no cells to speak for a load. */
  rowCount: number;
  /** The grid is drawing the previous state while the next one loads. */
  stale?: boolean;
  onRetry: () => void;
  /** Omit to render the edit error without a dismiss. */
  onDismissError?: () => void;
}) {
  if (status === "error") {
    return (
      <StatusCallout color="red" role="alert" icon={<CircleAlert size={16} />}>
        <Flex align="center" gap="3">
          <Callout.Text>Could not load rows.</Callout.Text>

          <Button size="1" variant="soft" color="red" onClick={onRetry}>
            Retry
          </Button>
        </Flex>
      </StatusCallout>
    );
  }

  // Above the edit error on purpose. The bar shows one line at a time, and a
  // load speaks for every row on screen while an edit error speaks for one
  // cell.
  //
  // The wait costs the user nothing. The edit error names its cell by ROW KEY —
  // `hooks/useCellRenderer.ts` builds `${rowKey}:${field}` — and not by
  // position, so a state change cannot make it point at the wrong row. It stays
  // in the slice and comes back to the bar the moment the load settles.
  if (stale) {
    return (
      <StatusCallout color="gray" role="status" icon={<Spinner size="1" />}>
        <Callout.Text>Loading…</Callout.Text>
      </StatusCallout>
    );
  }

  if (error !== null) {
    return (
      <StatusCallout color="red" role="alert" icon={<CircleAlert size={16} />}>
        <Flex align="center" gap="3">
          <Callout.Text>{error}</Callout.Text>

          {onDismissError !== undefined && (
            <Button size="1" variant="soft" color="red" onClick={onDismissError}>
              Dismiss
            </Button>
          )}
        </Flex>
      </StatusCallout>
    );
  }

  if (status === "loading" && rowCount === 0) {
    return (
      <StatusCallout color="gray" role="status" icon={<Spinner size="1" />}>
        <Callout.Text>Loading rows…</Callout.Text>
      </StatusCallout>
    );
  }

  return null;
}
