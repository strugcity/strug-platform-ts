import { describe, it, expectTypeOf } from 'vitest';
import type {
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
} from '../types.js';

describe('CalendarEvent shape', () => {
  it('requires uid, summary, dtstart, dtend', () => {
    const event: CalendarEvent = {
      uid: 'test-uid',
      summary: 'Practice',
      dtstart: new Date(),
      dtend: new Date(),
    };
    expectTypeOf(event.uid).toBeString();
    expectTypeOf(event.dtstart).toEqualTypeOf<Date>();
  });

  it('allows optional fields', () => {
    const event: CalendarEvent = {
      uid: 'test-uid',
      summary: 'Practice',
      dtstart: new Date(),
      dtend: new Date(),
      location: 'Field 4',
      rrule: 'FREQ=WEEKLY',
      sequence: 0,
      status: 'confirmed',
    };
    expectTypeOf(event.location).toEqualTypeOf<string | undefined>();
  });
});

describe('SubscriptionState', () => {
  it('errorCount is required (not optional)', () => {
    const state: SubscriptionState = {
      id: 'sub-1',
      url: 'https://example.com/cal.ics',
      status: 'pending',
      errorCount: 0,
    };
    expectTypeOf(state.errorCount).toBeNumber();
  });
});

describe('EventChange', () => {
  it('urgency is the correct union', () => {
    const change: EventChange = {
      type: 'event_added',
      urgency: 'routine',
      eventUid: 'uid-1',
      detectedAt: new Date(),
    };
    expectTypeOf(change.urgency).toEqualTypeOf<ChangeUrgency>();
  });
});

// Compile-time assertions — these are used by the type imports above
const _providerHint: ProviderHint = { provider: 'teamsnap', confidence: 'high', signals: [] };
const _fetchConfig: FetchConfig = { url: 'https://example.com/cal.ics' };
const _fetchResult: FetchResult = { events: [], notModified: false };
const _status: SubscriptionStatus = 'pending';
const _changeType: ChangeType = 'event_added';
const _provider: CalendarProvider = 'generic';
void _providerHint, _fetchConfig, _fetchResult, _status, _changeType, _provider;
