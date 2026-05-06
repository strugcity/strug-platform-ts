import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCalendar } from '../fetching/index.js';
import { SsrfGuardError } from '../errors.js';

const MOCK_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:e1@test
SUMMARY:Practice
DTSTART:20260601T140000Z
DTEND:20260601T160000Z
END:VEVENT
END:VCALENDAR`;

function mockFetch(status: number, body: string, headers: Record<string, string> = {}): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status,
    text: () => Promise.resolve(body),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  }));
}

describe('fetchCalendar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed events on 200', async () => {
    mockFetch(200, MOCK_ICS, { etag: '"etag-1"' });
    const result = await fetchCalendar({ url: 'https://example.com/cal.ics' });
    expect(result.notModified).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.etag).toBe('"etag-1"');
  });

  it('returns notModified:true on 304', async () => {
    mockFetch(304, '');
    const result = await fetchCalendar({
      url: 'https://example.com/cal.ics',
      etag: '"etag-1"',
    });
    expect(result.notModified).toBe(true);
    expect(result.events).toHaveLength(0);
  });

  it('sends If-None-Match header when etag is provided', async () => {
    mockFetch(304, '');
    await fetchCalendar({ url: 'https://example.com/cal.ics', etag: '"etag-1"' });
    const fetchMock = vi.mocked(fetch);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"etag-1"');
  });

  it('throws SsrfGuardError for http:// URLs', async () => {
    await expect(fetchCalendar({ url: 'http://example.com/cal.ics' }))
      .rejects.toThrowError(SsrfGuardError);
  });

  it('throws SsrfGuardError for private IPs', async () => {
    await expect(fetchCalendar({ url: 'https://192.168.1.1/cal.ics' }))
      .rejects.toThrowError(SsrfGuardError);
  });
});
