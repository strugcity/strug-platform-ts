import type { CalendarEvent, ICalFeedOptions } from '../types.js';
import { NotImplementedError } from '../errors.js';

/**
 * Generates an iCal feed string from a list of CalendarEvents.
 * @phase2 - Not implemented in v0.1
 */
export function generateICalFeed(
  _events: CalendarEvent[],
  _options: ICalFeedOptions,
): string {
  throw new NotImplementedError('generateICalFeed');
}
