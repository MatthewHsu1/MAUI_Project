import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GridStatusBar } from "./GridStatusBar";

describe("GridStatusBar", () => {
  it("renders nothing while rows load into a grid that already has rows", () => {
    const { container } = render(
      <GridStatusBar status="loading" error={null} rowCount={500} onRetry={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says a first load is loading, because a grid with no rows has no cells to say it", () => {
    render(<GridStatusBar status="loading" error={null} rowCount={0} onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading rows/i);
  });

  it("renders nothing when the grid is ready and has no error", () => {
    const { container } = render(
      <GridStatusBar status="ready" error={null} rowCount={0} onRetry={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers a retry when a load fails", async () => {
    const onRetry = vi.fn();
    render(<GridStatusBar status="error" error={null} rowCount={0} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows an edit error on top of a ready grid", () => {
    render(
      <GridStatusBar
        status="ready"
        error="Failed to save price"
        rowCount={10}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save price");
  });

  it("offers a dismiss for an edit error, so a user who stops editing is not stuck with it", async () => {
    const onDismissError = vi.fn();
    render(
      <GridStatusBar
        status="ready"
        error="Failed to save price"
        rowCount={10}
        onRetry={() => {}}
        onDismissError={onDismissError}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });
});
