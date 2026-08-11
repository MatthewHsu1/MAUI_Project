/**
 * What the mock server does before it answers. Mutable at run time, because the
 * page's control bar changes it while the grid is open.
 */
export interface MockConfig {
  /**
   * Delay before every response, in milliseconds. Zero answers immediately, and
   * then the grid never shows a loading state.
   */
  latencyMs: number;

  /**
   * Chance that a request answers 500 instead of doing its work, from 0 to 1.
   *
   * It defaults to 0. A grid that fails at random cannot be used to test
   * anything else, so the failure path is opt-in: turn it up when the failure
   * path IS the subject.
   */
  failureRate: number;
}

/**
 * The live config. It is a mutable object rather than a store because the MSW
 * handlers run outside React and read it per request.
 *
 * This module imports nothing on purpose. The page's control bar writes to it,
 * so it is reachable from the production bundle, while the generator, the
 * store, and the handlers are not.
 */
export const mockConfig: MockConfig = {
  latencyMs: 150,
  failureRate: 0,
};

/** Applies a partial change. */
export function setMockConfig(patch: Partial<MockConfig>): void {
  Object.assign(mockConfig, patch);
}
