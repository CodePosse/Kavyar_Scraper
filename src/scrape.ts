import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { BASE_URL, DATA_DIR, GET_PUBLISHED_URL, GENRES } from './config.js';
import type { Listing, ScrapeOutput } from './types.js';
import { dedupeByUrl, fetchHtml, normalizeWhitespace, parseBoolean, parseDate, parseNumber } from './utils.js';

function absoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
}

function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  const values: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      values.push(JSON.parse(raw));
    } catch {
      // ignore malformed blocks
    }
  });
  return values;
}

function extractSubmissionUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href*="/submissions/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) urls.add(absoluteUrl(href));
  });

  const rawHtml = $.html();
  const matches = rawHtml.match(/https:\/\/kavyar\.com\/[^"'\\s<]+\/submissions\/[^"'\\s<]+/g) ?? [];
  for (const match of matches) urls.add(match);

  return [...urls];
}

function parseSubmissionPage(url: string, html: string, sourceGenre: string | null): Listing {
  const $ = cheerio.load(html);
  const jsonLdBlocks = extractJsonLd(html);

  const pageTitle = normalizeWhitespace($('title').first().text());
  const h1 = normalizeWhitespace($('h1').first().text());

  let ld: Record<string, any> | null = null;
  for (const block of jsonLdBlocks) {
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      ld = block as Record<string, any>;
      break;
    }
  }

  const ownerName = normalizeWhitespace(
    ld?.publisher?.name ??
    ld?.author?.name ??
    $('[data-testid="profile-name"]').first().text() ??
    $('meta[property="og:site_name"]').attr('content') ??
    null
  );

  const title = normalizeWhitespace(
    ld?.headline ??
    ld?.name ??
    h1 ??
    pageTitle?.replace(/\s*-\s*Kavyar.*$/i, '') ??
    null
  );

  const descriptionText = normalizeWhitespace(
    ld?.description ?? $('meta[name="description"]').attr('content') ?? null
  ) ?? '';

  const text = $('body').text().replace(/\s+/g, ' ');
  const mediumMatch = text.match(/\b(Print|Digital|Online|Editorial)\b/i);
  const minMatch = text.match(/minimum\s+(\d+)\s+images?/i) || text.match(/min(?:imum)?\s+images?\s*:?\s*(\d+)/i);
  const maxMatch = text.match(/maximum\s+(\d+)\s+images?/i) || text.match(/max(?:imum)?\s+images?\s*:?\s*(\d+)/i);
  const followerMatch = text.match(/instagram[^\d]{0,20}([\d,]+)/i);
  const exclusivityMatch = text.match(/exclusiv(?:ity|e)[^a-z]{0,20}(required|not required|true|false|yes|no)/i);
  const deadlineMatch = text.match(/(?:deadline|close date|submissions close)[:\s]+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);

  const genreCandidates = new Set<string>();
  if (sourceGenre) genreCandidates.add(sourceGenre);
  descriptionText.split(/[,|]/).forEach((part) => {
    const normalized = normalizeWhitespace(part);
    if (normalized && normalized.length < 40 && /^[A-Za-z\-\s]+$/.test(normalized)) {
      if (['fashion','beauty','glamour','boudoir','artistic nude','swimwear','portrait','fine art'].includes(normalized.toLowerCase())) {
        genreCandidates.add(normalized.toLowerCase().replace(/\s+/g, '-'));
      }
    }
  });

  const deadlineParsed = parseDate(deadlineMatch?.[1] ?? null);

  const instagramRaw = $('a[href*="instagram.com/"]').first().attr('href') ?? null;

  return {
    ownerName,
    title,
    medium: normalizeWhitespace(mediumMatch?.[1] ?? null),
    genres: [...genreCandidates],
    deadline: deadlineParsed.iso,
    deadlineTs: deadlineParsed.ts,
    minImages: parseNumber(minMatch?.[1]),
    maxImages: parseNumber(maxMatch?.[1]),
    exclusivity: parseBoolean(exclusivityMatch?.[1] ?? null),
    ownerInstagram: instagramRaw,
    ownerInstagramFollowerCount: parseNumber(followerMatch?.[1]),
    ownerType: null,
    ownerCity: null,
    url,
    sourceGenre,
    sourceSection: 'get-published',
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeGenre(genre: string): Promise<Listing[]> {
  const url = `${GET_PUBLISHED_URL}/${genre}`;
  console.log(`Scraping genre page: ${url}`);
  const html = await fetchHtml(url);
  const submissionUrls = extractSubmissionUrls(html);
  console.log(`  Found ${submissionUrls.length} candidate submission URLs for ${genre}`);

  const listings: Listing[] = [];
  for (const submissionUrl of submissionUrls) {
    try {
      const submissionHtml = await fetchHtml(submissionUrl);
      listings.push(parseSubmissionPage(submissionUrl, submissionHtml, genre));
    } catch (error) {
      console.warn(`  Failed to fetch submission: ${submissionUrl}`, error);
    }
  }

  return listings;
}

async function main(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const allListings: Listing[] = [];

  for (const genre of GENRES) {
    try {
      const listings = await scrapeGenre(genre);
      allListings.push(...listings);
    } catch (error) {
      console.warn(`Failed to scrape genre ${genre}:`, error);
    }
  }

  const deduped = dedupeByUrl(allListings).sort((a, b) => {
    const aTs = a.deadlineTs ?? Number.MAX_SAFE_INTEGER;
    const bTs = b.deadlineTs ?? Number.MAX_SAFE_INTEGER;
    return aTs - bTs;
  });

  const output: ScrapeOutput = {
    generatedAt: new Date().toISOString(),
    source: GET_PUBLISHED_URL,
    listingCount: deduped.length,
    listings: deduped
  };

  const outputPath = path.join(DATA_DIR, 'listings.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${deduped.length} deduplicated listings to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
