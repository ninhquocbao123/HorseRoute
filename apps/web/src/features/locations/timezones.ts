// Same rule as the API: IANA "Area/Location" (or UTC) that Intl accepts; Intl alone also takes "+07:00" or any case.
const IANA_NAME = /^(?:UTC|[A-Z][A-Za-z]+(?:\/[A-Z][A-Za-z0-9_+-]*){1,2})$/;
export function isIanaTimezone(value: string) {
  if (!IANA_NAME.test(value)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}

/** Suggested zone when a country is picked (first zone for multi-zone countries; the Specialist can change it). */
export const COUNTRY_TIMEZONE: Record<string, string> = {
  VN: 'Asia/Ho_Chi_Minh', KH: 'Asia/Phnom_Penh', LA: 'Asia/Vientiane', TH: 'Asia/Bangkok', MY: 'Asia/Kuala_Lumpur', SG: 'Asia/Singapore',
  ID: 'Asia/Jakarta', PH: 'Asia/Manila', MM: 'Asia/Yangon', CN: 'Asia/Shanghai', HK: 'Asia/Hong_Kong', MO: 'Asia/Macau', TW: 'Asia/Taipei',
  JP: 'Asia/Tokyo', KR: 'Asia/Seoul', IN: 'Asia/Kolkata', AE: 'Asia/Dubai', QA: 'Asia/Qatar', SA: 'Asia/Riyadh',
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', GB: 'Europe/London', IE: 'Europe/Dublin', FR: 'Europe/Paris', DE: 'Europe/Berlin',
  NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', IT: 'Europe/Rome', ES: 'Europe/Madrid', US: 'America/New_York', CA: 'America/Toronto',
};

/** Browsers list canonical ICU names (Asia/Saigon); keep the names the catalog already uses first. */
export function timezoneOptions(extra: string[] = []) {
  let supported: string[] = [];
  try { supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; } catch { supported = []; }
  const names = [...new Set(['UTC', ...Object.values(COUNTRY_TIMEZONE), ...extra, ...supported])].filter(isIanaTimezone);
  return names.sort((a, b) => a.localeCompare(b)).map(value => ({ value }));
}
