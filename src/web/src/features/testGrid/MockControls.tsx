import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { rowsKeyPrefix } from "../dataGrid/hooks/useRowPages";
import { resetTestRows } from "./api/testRowQueries";
import { mockConfig, setMockConfig } from "./mocks/mockConfig";
import { GRID_NAME, testGrid } from "./testGrid";

const LATENCIES = [0, 150, 800];
const FAILURE_RATES = [0, 0.1, 0.5];

const barStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  padding: "8px 12px",
  borderBottom: "1px solid var(--gray-6)",
  fontSize: 13,
};

/**
 * The development control bar for the mock server.
 *
 * It writes straight to `mockConfig`, which the MSW handlers read per request.
 * Local state exists only so the selects re-render; the config object is the
 * single source of truth.
 */
export function MockControls() {
  const queryClient = useQueryClient();

  const [latencyMs, setLatencyMs] = useState(mockConfig.latencyMs);
  const [failureRate, setFailureRate] = useState(mockConfig.failureRate);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLatency = (value: number) => {
    setLatencyMs(value);
    setMockConfig({ latencyMs: value });
  };

  const onFailureRate = (value: number) => {
    setFailureRate(value);
    setMockConfig({ failureRate: value });
  };

  const onReset = async () => {
    setResetting(true);
    setError(null);

    try {
      await resetTestRows();

      // Every cached slice describes the old data, so drop them all. The count
      // is a separate query and needs the same treatment. Both keys are
      // PREFIXES: `rowCountKey` appends the collapse set, and resetQueries
      // matches by prefix, so this catches every variant.
      await queryClient.resetQueries({ queryKey: rowsKeyPrefix(GRID_NAME) });
      await queryClient.resetQueries({ queryKey: [GRID_NAME, "count"] });

      // The store is a second copy of those rows and no query touches it. The
      // bump routes the reset through the same hold a sort change takes, so the
      // old rows stay on screen, dimmed, until the new ones arrive.
      testGrid.bumpDataGeneration();
    } catch (cause) {
      // The reset request goes through the same mock server the bar can make
      // fail on purpose, so this is a path the user reaches deliberately, not a
      // theoretical one. Without the catch it is an unhandled rejection and a
      // button that silently did nothing.
      setError(cause instanceof Error ? cause.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={barStyle}>
      <label>
        Latency{" "}
        <select value={latencyMs} onChange={(e) => onLatency(Number(e.target.value))}>
          {LATENCIES.map((ms) => (
            <option key={ms} value={ms}>
              {ms} ms
            </option>
          ))}
        </select>
      </label>

      <label>
        Failures{" "}
        <select value={failureRate} onChange={(e) => onFailureRate(Number(e.target.value))}>
          {FAILURE_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {Math.round(rate * 100)}%
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onReset} disabled={resetting}>
        Reset data
      </button>

      {error && <span style={{ color: "var(--red-11)" }}>{error}</span>}
    </div>
  );
}
