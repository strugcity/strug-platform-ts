import { describe, it, expect } from 'vitest';
import { parseIcs } from '../parser/index.js';

const BASIC_ICS = `BEGIN:VCALENDAR
PRODID:-//Test//Test//EN
VERSION:2.0
BEGIN:VEVENT
UID:event-001@test
SUMMARY:Saturday Practice
DTSTART:20260601T140000Z
DTEND:20260601T160000Z
LOCATION:Field 4
END:VEVENT
END:VCALENDAR`;

const CANCELLED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-002@test
SUMMARY:Game
DTSTART:20260601T120000Z
DTEND:20260601T140000Z
STATUS:CANCELLED
SEQUENCE:1
END:VEVENT
END:VCALENDAR`;

const FOLDED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-003@test
SUMMARY:Long Event Title That Gets Folded Acros
 s Multiple Lines In The ICS File
DTSTART:20260601T100000Z
DTEND:20260601T120000Z
END:VEVENT
END:VCALENDAR`;

describe('parseIcs', () => {
  it('parses a basic VEVENT', () => {
    const events = parseIcs(BASIC_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('event-001@test');
    expect(events[0].summary).toBe('Saturday Practice');
    expect(events[0].dtstart).toBeInstanceOf(Date);
    expect(events[0].location).toBe('Field 4');
  });

  it('parses STATUS:CANCELLED and SEQUENCE', () => {
    const events = parseIcs(CANCELLED_ICS);
    expect(events[0].status).toBe('cancelled');
    expect(events[0].sequence).toBe(1);
  });

  it('unfolds folded lines per RFC 5545 §3.1', () => {
    const events = parseIcs(FOLDED_ICS);
    expect(events[0].summary).toBe('Long Event Title That Gets Folded Across Multiple Lines In The ICS File');
  });

  it('returns empty array for ICS with no VEVENTs', () => {
    const events = parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
    expect(events).toHaveLength(0);
  });

  it('normalizes DTSTART to a Date', () => {
    const events = parseIcs(BASIC_ICS);
    expect(events[0].dtstart.toISOString()).toBe('2026-06-01T14:00:00.000Z');
  });
});
