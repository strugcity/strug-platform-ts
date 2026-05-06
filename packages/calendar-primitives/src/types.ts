/** A parsed ICS VEVENT record. All dates are UTC-normalized. */
export interface CalendarEvent {
  /** VEVENT UID — required by RFC 5545, globally unique */
  uid: string;
  /** SUMMARY — human-readable event title */
  summary: string;
  /** DTSTART — UTC-normalized start time */
  dtstart: Date;
  /** DTEND — UTC-normalized end time */
  dtend: Date;
  /** LOCATION — venue or address */
  location?: string;
  /** DESCRIPTION — free-text notes */
  description?: string;
  /** RRULE — raw recurrence rule string (e.g. "FREQ=WEEKLY;BYDAY=SA") */
  rrule?: string;
  /** SEQUENCE — monotonically increasing update counter; default 0 */
  sequence?: number;
  /** LAST-MODIFIED — when the event was last changed on the server */
  lastModified?: Date;
  /** ORGANIZER — raw ORGANIZER value (not parsed) */
  organizer?: string;
  /** ATTENDEE list — raw values (not parsed) */
  attendees?: string[];
  /** STATUS — CONFIRMED | TENTATIVE | CANCELLED */
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

/** Known calendar providers with ICS quirks requiring preprocessing */
export type CalendarProvider = 'teamsnap' | 'gamechanger' | 'rschool' | 'generic';

/** Result of provider hint detection */
export interface ProviderHint {
  provider: CalendarProvider;
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable list of signals that matched */
  signals: string[];
}

/** Config for ETag-based conditional fetching */
export interface FetchConfig {
  /** Must be https:// — SSRF guard enforced */
  url: string;
  /** If-None-Match value from previous fetch */
  etag?: string;
  /** If-Modified-Since value from previous fetch */
  lastModified?: string;
  /** Request timeout in milliseconds; default 10000 */
  timeoutMs?: number;
}

/** Result of a conditional fetch */
export interface FetchResult {
  /** Parsed events — empty when notModified is true */
  events: CalendarEvent[];
  /** ETag from response, if present */
  etag?: string;
  /** Last-Modified from response, if present */
  lastModified?: string;
  /** True when server returned 304 Not Modified */
  notModified: boolean;
}

/** Subscription lifecycle states */
export type SubscriptionStatus =
  | 'pending'    // created, not yet fetched
  | 'active'     // last fetch succeeded
  | 'suspended'  // errorCount >= 5 consecutive failures
  | 'error'      // last fetch failed, errorCount < 5
  | 'expired';   // 410 Gone or TTL elapsed

/** Subscription state record — one per subscribed calendar URL */
export interface SubscriptionState {
  id: string;
  url: string;
  status: SubscriptionStatus;
  provider?: CalendarProvider;
  /** ETag from last successful fetch */
  etag?: string;
  lastFetchedAt?: Date;
  /** Consecutive failure count; resets to 0 on successful fetch */
  errorCount: number;
  lastError?: string;
}

/** How urgent a change notification is */
export type ChangeUrgency =
  | 'immediate'      // < 24h until event; or same-day cancellation
  | 'same_day'       // today but > 24h away
  | 'routine'        // > 1 day away
  | 'informational'; // non-time-sensitive (description, minor detail)

/** What changed in an event */
export type ChangeType =
  | 'event_added'
  | 'event_cancelled'
  | 'event_rescheduled'       // dtstart or dtend changed
  | 'event_location_changed'
  | 'event_details_changed';  // summary, description, or other non-time field

/** A detected calendar change */
export interface EventChange {
  type: ChangeType;
  urgency: ChangeUrgency;
  eventUid: string;
  /** Absent for event_added */
  before?: CalendarEvent;
  /** Absent for event_cancelled */
  after?: CalendarEvent;
  detectedAt: Date;
}

// ─── Phase 2 types (typed; implementations are stubs in v0.1) ─────────────────

/** GCal OAuth configuration */
export interface GCalOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** GCal OAuth token response */
export interface GCalToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Apple CalDAV connection config */
export interface CalDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  calendarPath?: string;
}

/** Options for generating an outbound iCal feed */
export interface ICalFeedOptions {
  title: string;
  description?: string;
  timezone?: string;
}
