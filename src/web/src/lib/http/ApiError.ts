/**
 * The single failure shape for every API call, whatever the cause — network
 * failure, non-2xx response, or an unparseable body. Consumers branch on
 * `status`/`code` and never inspect a `Response`.
 *
 * Fields are declared and assigned explicitly rather than via constructor
 * parameter properties: `erasableSyntaxOnly` in tsconfig.app.json forbids them.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Stable machine-readable cause, e.g. "network", "http", "unauthorized". */
  readonly code: string;
  /** Parsed response body or underlying error, when available. */
  readonly detail: unknown;

  constructor(status: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}
