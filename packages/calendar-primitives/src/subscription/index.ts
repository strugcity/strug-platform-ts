import type { SubscriptionState } from '../types.js';
import { InvalidTransitionError } from '../errors.js';

interface FetchSuccessPayload {
  etag: string | undefined;
  events: unknown[];
}

const SUSPENDED_THRESHOLD = 5;

/** Apply a successful fetch result to subscription state. */
export function applyFetchSuccess(
  state: SubscriptionState,
  payload: FetchSuccessPayload,
): SubscriptionState {
  if (state.status === 'suspended' || state.status === 'expired') {
    throw new InvalidTransitionError(state.status, 'active');
  }
  return {
    ...state,
    status: 'active',
    errorCount: 0,
    lastError: undefined,
    etag: payload.etag ?? state.etag,
    lastFetchedAt: new Date(),
  };
}

/** Apply a fetch failure to subscription state. */
export function applyFetchError(state: SubscriptionState, error: string): SubscriptionState {
  if (state.status === 'expired') {
    throw new InvalidTransitionError(state.status, 'error');
  }
  const newCount = state.errorCount + 1;
  return {
    ...state,
    status: newCount >= SUSPENDED_THRESHOLD ? 'suspended' : 'error',
    errorCount: newCount,
    lastError: error,
  };
}

/** Apply a 410 Gone response — marks subscription expired. */
export function applyGone(state: SubscriptionState): SubscriptionState {
  return { ...state, status: 'expired' };
}
