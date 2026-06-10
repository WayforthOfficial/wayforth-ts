/**
 * Thrown for any non-2xx response from the Wayforth gateway.
 * Matches the gateway's error response shape: { detail: string | { error, message, ... } }
 */
export class WayforthError extends Error {
  /** HTTP status code (401, 402, 429, etc.) */
  readonly status: number;
  /** Machine-readable error code from the gateway (e.g. "insufficient_credits") */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'WayforthError';
    this.status = status;
    this.code = code;
    // Maintain proper prototype chain in transpiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
