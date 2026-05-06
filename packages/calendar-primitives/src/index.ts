// Types
export type {
  CalendarEvent,
  CalendarProvider,
  ProviderHint,
  FetchConfig,
  FetchResult,
  SubscriptionStatus,
  SubscriptionState,
  ChangeUrgency,
  ChangeType,
  EventChange,
  GCalOAuthConfig,
  GCalToken,
  CalDAVConfig,
  ICalFeedOptions,
} from './types.js';

// Errors
export { SsrfGuardError, InvalidTransitionError, NotImplementedError } from './errors.js';

// Parser
export { parseIcs } from './parser/index.js';

// Provider detection
export { detectProvider } from './detection/index.js';

// Fetching
export { fetchCalendar } from './fetching/index.js';

// Subscription state machine
export { applyFetchSuccess, applyFetchError, applyGone } from './subscription/index.js';

// Change detection
export { detectChanges } from './diff/index.js';

// Phase 2 stubs
export { getGCalAuthUrl, exchangeGCalCode, writeGCalEvent } from './phase2/gcal.js';
export { fetchCalDAV } from './phase2/caldav.js';
export { generateICalFeed } from './phase2/feed.js';
