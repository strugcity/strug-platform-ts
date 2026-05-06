import { describe, it, expect } from 'vitest';
import { detectProvider } from '../detection/index.js';

describe('detectProvider', () => {
  it('detects TeamSnap by PRODID', () => {
    const hint = detectProvider({
      prodId: '-//TeamSnap//TeamSnap//EN',
      calName: undefined,
      url: undefined,
    });
    expect(hint.provider).toBe('teamsnap');
    expect(hint.confidence).toBe('high');
    expect(hint.signals.length).toBeGreaterThan(0);
  });

  it('detects TeamSnap by X-WR-CALNAME', () => {
    const hint = detectProvider({ prodId: undefined, calName: 'TeamSnap', url: undefined });
    expect(hint.provider).toBe('teamsnap');
  });

  it('detects GameChanger by PRODID', () => {
    const hint = detectProvider({ prodId: '-//GameChanger//App//EN', calName: undefined, url: undefined });
    expect(hint.provider).toBe('gamechanger');
    expect(hint.confidence).toBe('high');
  });

  it('detects rSchool by PRODID', () => {
    const hint = detectProvider({ prodId: '-//rSchoolToday//Cal//EN', calName: undefined, url: undefined });
    expect(hint.provider).toBe('rschool');
    expect(hint.confidence).toBe('high');
  });

  it('detects rSchool by URL path', () => {
    const hint = detectProvider({ prodId: undefined, calName: undefined, url: 'https://rschooltoday.com/ical/123' });
    expect(hint.provider).toBe('rschool');
  });

  it('returns generic with low confidence when no signals match', () => {
    const hint = detectProvider({ prodId: undefined, calName: undefined, url: undefined });
    expect(hint.provider).toBe('generic');
    expect(hint.confidence).toBe('low');
    expect(hint.signals).toHaveLength(0);
  });
});
