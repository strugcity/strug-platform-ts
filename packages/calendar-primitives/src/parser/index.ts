import type { CalendarEvent } from '../types.js';

/**
 * Unfolds RFC 5545 §3.1 line folding.
 * Lines beginning with a space or tab are continuations of the previous line.
 */
function unfold(ics: string): string {
  return ics.replace(/\r?\n[ \t]/g, '');
}

/**
 * Parses an ICS date string (YYYYMMDDTHHMMSSZ or YYYYMMDD) to a UTC Date.
 */
function parseDate(value: string): Date {
  // Strip TZID= prefix if present (e.g. DTSTART;TZID=America/Chicago:20260601T090000)
  const v = value.includes(':') ? value.split(':').pop()! : value;
  if (v.endsWith('Z') || v.length === 15) {
    // UTC format: 20260601T140000Z
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`,
    );
  }
  // Date-only: 20260601
  return new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`);
}

/**
 * Parses an ICS string and returns all VEVENT records as CalendarEvent objects.
 * Handles RFC 5545 line folding. Provider-specific preprocessing is applied
 * before calling this function (via preprocessForProvider).
 */
export function parseIcs(ics: string): CalendarEvent[] {
  const unfolded = unfold(ics);
  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let current: Partial<CalendarEvent> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.uid && current.summary && current.dtstart && current.dtend) {
        events.push(current as CalendarEvent);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    // Split on first colon (property:value); handle property params (e.g. DTSTART;TZID=...)
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const propWithParams = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const prop = propWithParams.split(';')[0].toUpperCase();

    switch (prop) {
      case 'UID': current.uid = value; break;
      case 'SUMMARY': current.summary = value; break;
      case 'DTSTART': current.dtstart = parseDate(value || propWithParams); break;
      case 'DTEND': current.dtend = parseDate(value || propWithParams); break;
      case 'LOCATION': current.location = value; break;
      case 'DESCRIPTION': current.description = value.replace(/\\n/g, '\n'); break;
      case 'RRULE': current.rrule = value; break;
      case 'SEQUENCE': current.sequence = parseInt(value, 10); break;
      case 'LAST-MODIFIED': current.lastModified = parseDate(value); break;
      case 'ORGANIZER': current.organizer = value; break;
      case 'ATTENDEE':
        current.attendees = [...(current.attendees ?? []), value];
        break;
      case 'STATUS':
        current.status = value.toLowerCase() as CalendarEvent['status'];
        break;
    }
  }

  return events;
}
