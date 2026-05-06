import { describe, it, expect } from 'vitest';
import { applyFetchSuccess, applyFetchError, applyGone } from '../subscription/index.js';
import { InvalidTransitionError } from '../errors.js';
import type { SubscriptionState } from '../types.js';

function makeState(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return { id: 's1', url: 'https://example.com/cal.ics', status: 'pending', errorCount: 0, ...overrides };
}

describe('applyFetchSuccess', () => {
  it('moves pending → active', () => {
    const next = applyFetchSuccess(makeState(), { etag: '"abc"', events: [] });
    expect(next.status).toBe('active');
    expect(next.errorCount).toBe(0);
    expect(next.etag).toBe('"abc"');
  });

  it('resets errorCount on error → active', () => {
    const s = makeState({ status: 'error', errorCount: 3 });
    const next = applyFetchSuccess(s, { etag: undefined, events: [] });
    expect(next.status).toBe('active');
    expect(next.errorCount).toBe(0);
  });

  it('throws on suspended → active (forbidden transition)', () => {
    const s = makeState({ status: 'suspended' });
    expect(() => applyFetchSuccess(s, { etag: undefined, events: [] }))
      .toThrowError(InvalidTransitionError);
  });

  it('throws on expired → active (forbidden transition)', () => {
    const s = makeState({ status: 'expired' });
    expect(() => applyFetchSuccess(s, { etag: undefined, events: [] }))
      .toThrowError(InvalidTransitionError);
  });
});

describe('applyFetchError', () => {
  it('moves pending → error', () => {
    const next = applyFetchError(makeState(), 'timeout');
    expect(next.status).toBe('error');
    expect(next.errorCount).toBe(1);
    expect(next.lastError).toBe('timeout');
  });

  it('suspends at errorCount 5', () => {
    const s = makeState({ status: 'error', errorCount: 4 });
    const next = applyFetchError(s, 'timeout');
    expect(next.status).toBe('suspended');
    expect(next.errorCount).toBe(5);
  });

  it('throws on expired → error (forbidden transition)', () => {
    const s = makeState({ status: 'expired' });
    expect(() => applyFetchError(s, 'timeout'))
      .toThrowError(InvalidTransitionError);
  });
});

describe('applyGone', () => {
  it('moves any status → expired', () => {
    for (const status of ['pending', 'active', 'error', 'suspended'] as const) {
      const next = applyGone(makeState({ status }));
      expect(next.status).toBe('expired');
    }
  });
});
