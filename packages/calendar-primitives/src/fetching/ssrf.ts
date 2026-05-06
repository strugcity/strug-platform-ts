import { SsrfGuardError } from '../errors.js';

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

/**
 * Asserts that the given URL is safe to fetch (https, no private IPs, no localhost).
 * Throws SsrfGuardError if the URL fails any check.
 */
export function assertSsrfSafe(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfGuardError(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new SsrfGuardError(`URL must use https:// scheme, got: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();

  if (host === 'localhost') {
    throw new SsrfGuardError(`SSRF blocked: localhost`);
  }

  for (const pattern of PRIVATE_IPV4) {
    if (pattern.test(host)) {
      throw new SsrfGuardError(`SSRF blocked: private IP range ${host}`);
    }
  }
}
