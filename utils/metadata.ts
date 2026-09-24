// utils/metadata.ts
// Fetches a URL and extracts page metadata (title, description, og:image,
// site name, author, language, type, publish date) using lightweight regex
// parsing. Network I/O (`fetch`) runs on the native thread and never blocks
// the JS/UI thread.

import type { BookmarkType } from '@/types/bookmarks';
import type { NewBookmark } from '@/db/schema';
import { debugLog, pushEvent } from './debug';
import { urlHashFor } from './hash';
import { resolveBackendConfig } from './backendConfig';

export const METADATA_TIMEOUT_MS = 12000;

// Sites that serve a consent/JS shell (or require a crawler UA) to normal
// browser-like clients, so a device-side direct fetch cannot extract metadata.
export const WALLED_HOSTS = [
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'x.com',
  'twitter.com',
  'youtube.com',
] as const;

export function isWalledDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return WALLED_HOSTS.some((host) => d === host || d.endsWith(`.${host}`));
}

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

export function decodeEntities(value: string | null): string {
  if (!value) return '';
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
    decodeEntities(readMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'thumbnail'])),
    decodeEntities(readMeta(html, ['og:image:secure_url'])),
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

// ─────────────────────────────────────────────
// Server-side extraction fallback
// ─────────────────────────────────────────────

export interface ExtractorResult {
  status?: number;
  url?: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  publishedAt?: number | null;
  language?: string;
  type?: string;
}

/**
 * True when a direct parse produced no meaningful metadata, i.e. the card
 * would render as a bare hostname link with no thumbnail.
 */
export function isEmptyMetadata(patch: Partial<NewBookmark>): boolean {
  const titleMissing = !patch.title || patch.title.length === 0 || patch.title === patch.domain;
  return !patch.image && titleMissing;
}

function mapExtractorResult(url: string, meta: ExtractorResult): Partial<NewBookmark> | null {
  if (!meta.title && !meta.image) return null;

  let parsed: URL;
  try {
    parsed = new URL(meta.url ?? meta.canonicalUrl ?? url);
  } catch {
    parsed = new URL(url);
  }
  const domain = parsed.hostname || '';

  const image = decodeEntities(meta.image ?? '');
  const validImage = image && /^https?:\/\//i.test(image) ? image : '';

  return {
    title: cleanText(decodeEntities(meta.title || domain)).slice(0, 500),
    description: cleanText(decodeEntities(meta.description || '')).slice(0, 1000),
    image: validImage,
    favicon: faviconForDomain(domain),
    siteName: cleanText(decodeEntities(meta.siteName || domain)).slice(0, 200),
    author: cleanText(decodeEntities(meta.author || '')).slice(0, 200),
    publishedAt: typeof meta.publishedAt === 'number' ? meta.publishedAt : null,
    language: (meta.language || '').toLowerCase().split('-')[0],
    type: mapType(meta.type ?? ''),
  };
}

type FetchOutcome = { status?: number; data?: unknown; error?: string };

async function fetchJsonWithOutcome(
  input: string,
  headers?: Record<string, string>
): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const res = await fetch(input, { signal: controller.signal, headers });
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    return { status: res.status, data: await res.json() };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `timeout after ${METADATA_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err);
    return { error: reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Calls our FastAPI extractor (backend/). Never throws. */
const EXTRACTOR_PATH = '/metadata';

export async function fetchMetadataViaExtractor(
  url: string,
  baseUrl: string,
  apiKey = ''
): Promise<ExtractorResult | null> {
  const target = `${baseUrl}${EXTRACTOR_PATH}?url=${encodeURIComponent(
    url
  )}&timeout_ms=${METADATA_TIMEOUT_MS}`;
  debugLog('extractor', 'requesting', target);
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
  const outcome = await fetchJsonWithOutcome(target, headers);
  if (outcome.data && typeof outcome.data === 'object') {
    return outcome.data as ExtractorResult;
  }
  const reason = outcome.error ?? `status=${outcome.status ?? '?'}`;
  debugLog('extractor', 'failed', reason);
  pushEvent('extractor', `failed ${reason}`);
  return null;
}

/**
 * Interim fallback: the public link-preview API used by react-native-preview-url.
 * Only used when no self-hosted extractor is configured. Never throws.
 */
export async function fetchMetadataFromAzizbecha(url: string): Promise<ExtractorResult | null> {
  const AZIZBECHA_API = 'https://azizbecha-link-preview-api.vercel.app/get';
  const outcome = await fetchJsonWithOutcome(
    `${AZIZBECHA_API}?url=${encodeURIComponent(url)}&timeout=15000`
  );
  const data = outcome.data;
  if (!data || typeof data !== 'object') {
    debugLog('azizbecha', 'failed', outcome.error ?? `status=${outcome.status ?? '?'}`);
    return null;
  }

  const raw = data as {
    status?: number;
    title?: string;
    description?: string;
    url?: string;
    canonical?: string;
    siteName?: string;
    images?: { url?: string }[];
  };

  if (!raw.title && !raw.images?.length) {
    debugLog('azizbecha', 'no data');
    return null;
  }

  debugLog('azizbecha', 'loaded', raw.title ?? raw.url ?? '?');
  return {
    status: raw.status,
    url: raw.url,
    canonicalUrl: raw.canonical,
    title: raw.title,
    description: raw.description,
    image: raw.images?.find((img) => img.url)?.url ?? '',
    siteName: raw.siteName,
  };
}

export type ExtractSource = 'self-hosted' | 'interim';

/**
 * Default extraction path used by enrichment: prefer our self-hosted FastAPI
 * extractor, else the interim third-party API. Returns null when both fail,
 * otherwise the mapped patch plus which source produced it.
 */
export async function fetchExtractedMetadata(
  url: string
): Promise<{ patch: Partial<NewBookmark>; source: ExtractSource } | null> {
  const startedAt = Date.now();
  let meta: ExtractorResult | null = null;
  let source: ExtractSource = 'interim';

  const config = await resolveBackendConfig();
  if (config) {
    source = 'self-hosted';
    meta = await fetchMetadataViaExtractor(url, config.baseUrl, config.apiKey);
  }
  if (!meta) {
    source = 'interim';
    debugLog('metadata', 'falling back to interim API');
    meta = await fetchMetadataFromAzizbecha(url);
  }

  const patch = meta ? mapExtractorResult(url, meta) : null;
  const ms = Date.now() - startedAt;
  pushEvent('enrich', `extractor=${source} ${ms}ms ${patch ? 'loaded' : 'no-metadata'}`);
  return patch ? { patch, source } : null;
}
