export function normalizeWhitespace(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

export function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseBoolean(value: string | null | undefined): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['true', 'yes', 'required'].includes(v)) return true;
  if (['false', 'no', 'not required'].includes(v)) return false;
  return null;
}

export function parseDate(value: string | null | undefined): { iso: string | null; ts: number | null } {
  if (!value) return { iso: null, ts: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { iso: null, ts: null };
  return { iso: date.toISOString(), ts: date.getTime() };
}

export function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.url)) seen.set(item.url, item);
  }
  return [...seen.values()];
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; KavyarStaticSite/0.1)'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
