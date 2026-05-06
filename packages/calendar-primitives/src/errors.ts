/** Thrown when a URL fails the SSRF guard check. */
export class SsrfGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfGuardError';
  }
}

/** Thrown when a subscription state transition is not allowed. */
export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid subscription transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/** Thrown by Phase 2 stub implementations that have not yet been built. */
export class NotImplementedError extends Error {
  constructor(functionName: string) {
    super(`${functionName} is not implemented in v0.1 — Phase 2 work required`);
    this.name = 'NotImplementedError';
  }
}
