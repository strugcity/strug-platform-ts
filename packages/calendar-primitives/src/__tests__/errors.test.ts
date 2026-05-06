import { describe, it, expect } from 'vitest';
import { SsrfGuardError, InvalidTransitionError, NotImplementedError } from '../errors.js';

describe('SsrfGuardError', () => {
  it('is an Error instance with the given message', () => {
    const err = new SsrfGuardError('private IP blocked');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SsrfGuardError);
    expect(err.message).toBe('private IP blocked');
    expect(err.name).toBe('SsrfGuardError');
  });
});

describe('InvalidTransitionError', () => {
  it('includes from/to states in the message', () => {
    const err = new InvalidTransitionError('active', 'pending');
    expect(err.message).toContain('active');
    expect(err.message).toContain('pending');
    expect(err.name).toBe('InvalidTransitionError');
  });
});

describe('NotImplementedError', () => {
  it('names the unimplemented function', () => {
    const err = new NotImplementedError('gcalOAuthFlow');
    expect(err.message).toContain('gcalOAuthFlow');
    expect(err.name).toBe('NotImplementedError');
  });
});
