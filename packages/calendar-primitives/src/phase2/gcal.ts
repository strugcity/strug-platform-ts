import type { GCalOAuthConfig, GCalToken, CalendarEvent } from '../types.js';
import { NotImplementedError } from '../errors.js';

/**
 * Initiates the GCal OAuth 2.0 authorization flow.
 * Returns the authorization URL to redirect the user to.
 * @phase2 - Not implemented in v0.1
 */
export function getGCalAuthUrl(_config: GCalOAuthConfig): string {
  throw new NotImplementedError('getGCalAuthUrl');
}

/**
 * Exchanges an authorization code for a GCal OAuth token.
 * @phase2 - Not implemented in v0.1
 */
export async function exchangeGCalCode(
  _config: GCalOAuthConfig,
  _code: string,
): Promise<GCalToken> {
  throw new NotImplementedError('exchangeGCalCode');
}

/**
 * Writes a CalendarEvent back to a user's Google Calendar.
 * @phase2 - Not implemented in v0.1
 */
export async function writeGCalEvent(
  _token: GCalToken,
  _calendarId: string,
  _event: CalendarEvent,
): Promise<void> {
  throw new NotImplementedError('writeGCalEvent');
}
