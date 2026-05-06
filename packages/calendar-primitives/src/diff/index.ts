import type { CalendarEvent, EventChange, ChangeUrgency } from '../types.js';

const MS_24H = 24 * 60 * 60 * 1000;

function classifyUrgency(eventStart: Date, now: Date): ChangeUrgency {
  const msUntil = eventStart.getTime() - now.getTime();
  if (msUntil < MS_24H) return 'immediate';
  if (msUntil < 2 * MS_24H) return 'same_day';
  return 'routine';
}

function indexByUid(events: CalendarEvent[]): Map<string, CalendarEvent> {
  return new Map(events.map((e) => [e.uid, e]));
}

/**
 * Compares two snapshots of a calendar feed and returns a list of detected changes.
 * `before` is the previously-fetched event list; `after` is the new fetch.
 */
export function detectChanges(
  before: CalendarEvent[],
  after: CalendarEvent[],
): EventChange[] {
  const changes: EventChange[] = [];
  const now = new Date();
  const beforeMap = indexByUid(before);
  const afterMap = indexByUid(after);

  // Additions: UIDs in after but not before — always routine per standard
  for (const [uid, event] of afterMap) {
    if (!beforeMap.has(uid)) {
      changes.push({
        type: 'event_added',
        urgency: 'routine',
        eventUid: uid,
        after: event,
        detectedAt: now,
      });
    }
  }

  // Removals: UIDs in before but not after
  for (const [uid, event] of beforeMap) {
    if (!afterMap.has(uid)) {
      changes.push({
        type: 'event_cancelled',
        urgency: classifyUrgency(event.dtstart, now),
        eventUid: uid,
        before: event,
        detectedAt: now,
      });
    }
  }

  // Modifications: UIDs in both
  for (const [uid, b] of beforeMap) {
    const a = afterMap.get(uid);
    if (!a) continue;

    if (b.dtstart.getTime() !== a.dtstart.getTime() || b.dtend.getTime() !== a.dtend.getTime()) {
      changes.push({
        type: 'event_rescheduled',
        urgency: classifyUrgency(a.dtstart, now),
        eventUid: uid,
        before: b,
        after: a,
        detectedAt: now,
      });
    } else if (b.location !== a.location) {
      changes.push({
        type: 'event_location_changed',
        urgency: classifyUrgency(a.dtstart, now),
        eventUid: uid,
        before: b,
        after: a,
        detectedAt: now,
      });
    } else if (b.summary !== a.summary || b.description !== a.description) {
      changes.push({
        type: 'event_details_changed',
        urgency: 'informational',
        eventUid: uid,
        before: b,
        after: a,
        detectedAt: now,
      });
    }
  }

  return changes;
}
