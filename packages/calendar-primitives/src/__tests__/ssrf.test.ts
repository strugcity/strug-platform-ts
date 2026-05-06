import { describe, it, expect } from 'vitest';
import { assertSsrfSafe } from '../fetching/ssrf.js';
import { SsrfGuardError } from '../errors.js';

describe('assertSsrfSafe', () => {
  it('allows a valid https URL', () => {
    expect(() => assertSsrfSafe('https://teamsnap.com/calendar.ics')).not.toThrow();
  });

  it('throws on http://', () => {
    expect(() => assertSsrfSafe('http://example.com/cal.ics'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on localhost', () => {
    expect(() => assertSsrfSafe('https://localhost/cal.ics'))
      .toThrowError(SsrfGuardError);
    expect(() => assertSsrfSafe('https://LOCALHOST/cal.ics'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on 127.x.x.x', () => {
    expect(() => assertSsrfSafe('https://127.0.0.1/cal.ics'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on 10.x.x.x', () => {
    expect(() => assertSsrfSafe('https://10.0.0.1/cal.ics'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on 192.168.x.x', () => {
    expect(() => assertSsrfSafe('https://192.168.1.1/cal.ics'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on 172.16.x.x through 172.31.x.x', () => {
    expect(() => assertSsrfSafe('https://172.16.0.1/cal.ics'))
      .toThrowError(SsrfGuardError);
    expect(() => assertSsrfSafe('https://172.31.255.255/cal.ics'))
      .toThrowError(SsrfGuardError);
    expect(() => assertSsrfSafe('https://172.32.0.1/cal.ics'))
      .not.toThrow();
  });

  it('throws on file:// scheme', () => {
    expect(() => assertSsrfSafe('file:///etc/passwd'))
      .toThrowError(SsrfGuardError);
  });

  it('throws on malformed URL', () => {
    expect(() => assertSsrfSafe('not-a-url'))
      .toThrowError(SsrfGuardError);
  });
});
