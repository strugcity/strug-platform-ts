import type { ProviderHint } from '../types.js';

interface DetectionInput {
  prodId: string | undefined;
  calName: string | undefined;
  url: string | undefined;
}

/**
 * Detects the calendar provider from ICS calendar-level fields.
 * Call this once per feed URL, not per event.
 */
export function detectProvider(input: DetectionInput): ProviderHint {
  const signals: string[] = [];
  const prodId = input.prodId?.toLowerCase() ?? '';
  const calName = input.calName?.toLowerCase() ?? '';
  const url = input.url?.toLowerCase() ?? '';

  if (prodId.includes('teamsnap') || calName.includes('teamsnap')) {
    if (prodId.includes('teamsnap')) signals.push('PRODID contains "TeamSnap"');
    if (calName.includes('teamsnap')) signals.push('X-WR-CALNAME contains "TeamSnap"');
    return { provider: 'teamsnap', confidence: 'high', signals };
  }

  if (prodId.includes('gamechanger') || url.includes('gc.com')) {
    if (prodId.includes('gamechanger')) signals.push('PRODID contains "GameChanger"');
    if (url.includes('gc.com')) signals.push('URL contains gc.com');
    return { provider: 'gamechanger', confidence: 'high', signals };
  }

  if (prodId.includes('rschooltoday') || url.includes('rschooltoday.com')) {
    if (prodId.includes('rschooltoday')) signals.push('PRODID contains "rSchoolToday"');
    if (url.includes('rschooltoday.com')) signals.push('URL contains rschooltoday.com');
    return { provider: 'rschool', confidence: 'high', signals };
  }

  return { provider: 'generic', confidence: 'low', signals: [] };
}
