import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectChanges } from '../diff/index.js';
import type { CalendarEvent } from '../types.js';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: 'event-1',
    summary: 'Practice',
    dtstart: new Date('2026-06-05T14:00:00Z'),
    dtend: new Date('2026-06-05T16:00:00Z'),
    ...overrides,
  };
}

describe('detectChanges', () => {
  const NOW = new Date('2026-06-04T12:00:00Z'); // 26h before event start

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('detects event_added for new UIDs', () => {
    const changes = detectChanges([], [makeEvent()]);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('event_added');
    expect(changes[0].urgency).toBe('routine'); // >24h away
  });

  it('detects event_cancelled for removed UIDs', () => {
    const changes = detectChanges([makeEvent()], []);
    expect(changes[0].type).toBe('event_cancelled');
  });

  it('detects event_rescheduled when dtstart changes', () => {
    const before = makeEvent();
    const after = makeEvent({ dtstart: new Date('2026-06-06T14:00:00Z') });
    const changes = detectChanges([before], [after]);
    expect(changes[0].type).toBe('event_rescheduled');
    expect(changes[0].before?.uid).toBe('event-1');
    expect(changes[0].after?.uid).toBe('event-1');
  });

  it('detects event_location_changed', () => {
    const before = makeEvent({ location: 'Field 4' });
    const after = makeEvent({ location: 'Field 6' });
    const changes = detectChanges([before], [after]);
    expect(changes[0].type).toBe('event_location_changed');
  });

  it('detects event_details_changed for summary change', () => {
    const before = makeEvent({ summary: 'Practice' });
    const after = makeEvent({ summary: 'Cancelled Practice' });
    const changes = detectChanges([before], [after]);
    expect(changes[0].type).toBe('event_details_changed');
    expect(changes[0].urgency).toBe('informational');
  });

  it('marks urgency immediate for rescheduled event within 24h', () => {
    // NOW is 2026-06-04T12:00Z; event 12h from now = within 24h → immediate
    const after = makeEvent({ dtstart: new Date('2026-06-05T00:00:00Z') });
    const changes = detectChanges([makeEvent()], [after]);
    expect(changes[0].urgency).toBe('immediate');
  });

  it('returns empty array when no changes', () => {
    const event = makeEvent();
    expect(detectChanges([event], [event])).toHaveLength(0);
  });
});
