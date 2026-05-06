import type { CalDAVConfig, CalendarEvent } from '../types.js';
import { NotImplementedError } from '../errors.js';

/**
 * Fetches events from an Apple CalDAV server.
 * @phase2 - Not implemented in v0.1
 */
export async function fetchCalDAV(
  _config: CalDAVConfig,
  _dateRange: { start: Date; end: Date },
): Promise<CalendarEvent[]> {
  throw new NotImplementedError('fetchCalDAV');
}
