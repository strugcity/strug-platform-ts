import type { FetchConfig, FetchResult } from '../types.js';
import { parseIcs } from '../parser/index.js';
import { assertSsrfSafe } from './ssrf.js';

/**
 * Fetches an ICS feed with ETag-based conditional fetching.
 * Enforces SSRF guard — throws SsrfGuardError for unsafe URLs.
 */
export async function fetchCalendar(config: FetchConfig): Promise<FetchResult> {
  assertSsrfSafe(config.url);

  const headers: Record<string, string> = {
    'Accept': 'text/calendar',
    'User-Agent': 'StrugsCity-CalendarPrimitives/0.1',
  };

  if (config.etag) {
    headers['If-None-Match'] = config.etag;
  }
  if (config.lastModified) {
    headers['If-Modified-Since'] = config.lastModified;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);

  try {
    const response = await fetch(config.url, { headers, signal: controller.signal });

    if (response.status === 304) {
      return { events: [], notModified: true };
    }

    const body = await response.text();
    const events = parseIcs(body);
    const etag = response.headers.get('etag') ?? undefined;
    const lastModified = response.headers.get('last-modified') ?? undefined;

    return { events, etag, lastModified, notModified: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
