// utils/metadata.ts
// Fetches a URL and extracts page metadata (title, description, og:image,
// site name, author, language, type, publish date) using lightweight regex
// parsing. Network I/O (`fetch`) runs on the native thread and never blocks
// the JS/UI thread.

import type { BookmarkType } from '@/types/bookmarks';
import type { NewBookmark } from '@/db/schema';
import { urlHashFor } from './hash';

export const METADATA_TIMEOUT_MS = 12000;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ─────────────────────────────────────────────
// HTML utilities
// ─────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const META_TAG_RE = /<meta\b[^>]*>/gi;

function readMeta(html: string, values: string[]): string | null {
  for (const match of html.matchAll(META_TAG_RE)) {
    const tag = match[0];
    const isMatch = values.some((v) =>
      new RegExp(`(?:property|name|itemprop|http-equiv)\\s*=\\s*["']${v}["']`, 'i').test(tag)
    );
    if (!isMatch) continue;
    const content = /(?:content|href|value)\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (content && content[1].trim()) return content[1].trim();
  }
  return null;
}

function readTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? cleanText(decodeEntities(match[1])) : null;
}

function readHtmlLang(html: string): string | null {
  const match = /<html[^>]*\slang\s*=\s*["']([^"']+)["']/i.exec(html);
  return match ? match[1].toLowerCase().split('-')[0] : null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toAbsolute(base: string, value: string | null): string | null {
  if (!value || /^(data|blob):/i.test(value)) return null;
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

function firstHttpUrl(base: string, values: (string | null)[]): string | null {
  for (const v of values) {
    const abs = toAbsolute(base, v);
    if (abs && /^https?:\/\//i.test(abs)) return abs;
  }
  return null;
}

function toTimestamp(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function mapType(raw: string | null): BookmarkType {
  const t = raw?.toLowerCase() ?? '';
  if (t.includes('video')) return 'video';
  if (t.includes('image')) return 'image';
  if (t.includes('article') || t.includes('news') || t.includes('blog')) return 'article';
  return 'link';
}

export function faviconForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

/**
 * Fetches and parses a page's metadata. Throws on network errors/timeouts so
 * callers can decide how to handle a failed enrichment.
 */
export async function fetchPageMetadata(url: string): Promise<Partial<NewBookmark>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);

  let finalUrl = url;
  let html = '';
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    finalUrl = res.url || url;
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  let parsed: URL;
  try {
    parsed = new URL(finalUrl);
  } catch {
    parsed = new URL(url);
  }
  const domain = parsed.hostname || '';
  const path = parsed.pathname || '';

  const ogType = readMeta(html, ['og:type']);
  const image = firstHttpUrl(finalUrl, [
    readMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'thumbnail']),
    readMeta(html, ['og:image:secure_url']),
  ]);

  const publishedFromMeta = toTimestamp(
    readMeta(html, ['article:published_time', 'og:article:published_time', 'date', 'datePublished'])
  );

  return {
    url: finalUrl,
    urlHash: urlHashFor(finalUrl),
    domain,
    path,
    title: cleanText(
      decodeEntities(readMeta(html, ['og:title', 'twitter:title']) || readTitle(html) || domain)
    ).slice(0, 500),
    description: cleanText(
      decodeEntities(readMeta(html, ['og:description', 'twitter:description', 'description']) || '')
    ).slice(0, 1000),
    image: image || '',
    favicon: faviconForDomain(domain),
    siteName: cleanText(
      decodeEntities(readMeta(html, ['og:site_name', 'application-name']) || domain)
    ).slice(0, 200),
    author: cleanText(decodeEntities(readMeta(html, ['author', 'article:author']) || '')).slice(
      0,
      200
    ),
    publishedAt: publishedFromMeta,
    language:
      readHtmlLang(html) ||
      readMeta(html, ['language', 'content-language'])?.toLowerCase().split('-')[0] ||
      '',
    type: mapType(ogType),
  };
}
