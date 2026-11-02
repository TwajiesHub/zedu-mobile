import { CLIENT_BASE_URL } from '@/utils/client-url';
import { ensureHttpsUrl } from '@/utils/link-url';
import { getPlainMessageText } from '@/utils/message-text';
import { isDocumentUrl } from '@/utils/document-preview';

export type LinkPreviewData = {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
};

const URL_IN_TEXT_REGEX =
  /((?:https?:\/\/|www\.)[^\s<"']+|\b(?:[\w-]+\.)+(?:com|co|ng|net|org|io|dev|ai|app|cc)\b(?!\.\w)(?:\/[^\s<"']*)?)/gi;

/**
 * A bare domain (no http:// or www.) that touches an "@" is part of an email
 * address, not a link of its own: the "zedu.com" in "ada@zedu.com", or the
 * "john.co" in "john.co@zedu.com". Domains after a space, a dot or a dash are
 * still links.
 */
const isEmbeddedBareDomain = (
  text: string,
  match: RegExpExecArray,
): boolean => {
  if (/^(?:https?:\/\/|www\.)/i.test(match[1])) return false;
  return (
    text[match.index - 1] === '@' || text[match.index + match[0].length] === '@'
  );
};

const previewCache = new Map<string, LinkPreviewData | null>();

const normalizeExtractedUrl = (raw: string): string => {
  let cleaned = raw.replace(/['">,.;!?)}\]]+$/g, '');
  if (cleaned.startsWith('www.')) {
    cleaned = `https://${cleaned}`;
  } else if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = ensureHttpsUrl(cleaned);
  }
  return cleaned;
};

/** Extract unique http(s) URLs from TipTap/HTML message text. */
export function extractMessageUrls(
  htmlOrText: string,
  excludeUrls: string[] = [],
): string[] {
  if (!htmlOrText) return [];

  const plain = getPlainMessageText(htmlOrText) || htmlOrText;
  const exclude = new Set(
    excludeUrls
      .filter(Boolean)
      .map(u => ensureHttpsUrl(u).replace(/\/$/, '').toLowerCase()),
  );

  const found: string[] = [];
  const seen = new Set<string>();

  URL_IN_TEXT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_IN_TEXT_REGEX.exec(plain)) !== null) {
    if (isEmbeddedBareDomain(plain, match)) continue;
    const url = normalizeExtractedUrl(match[1]);
    const key = url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key) || exclude.has(key) || isDocumentUrl(url)) {
      continue;
    }
    seen.add(key);
    found.push(url);
  }

  return found;
}

export function messageHasPreviewableLinks(
  htmlOrText: string,
  excludeUrls: string[] = [],
): boolean {
  return extractMessageUrls(htmlOrText, excludeUrls).length > 0;
}

export async function fetchLinkPreview(
  url: string,
): Promise<LinkPreviewData | null> {
  const href = ensureHttpsUrl(url);
  if (previewCache.has(href)) {
    return previewCache.get(href) ?? null;
  }

  const base = CLIENT_BASE_URL;

  try {
    const response = await fetch(
      `${base}/api/link-preview?url=${encodeURIComponent(href)}`,
    );
    if (!response.ok) {
      previewCache.set(href, null);
      return null;
    }

    const data = (await response.json()) as LinkPreviewData;
    const title = (data?.title || '').trim();
    let hostname = '';
    try {
      hostname = new URL(href).hostname;
    } catch {
      hostname = href;
    }

    const preview =
      title && title !== 'No Title'
        ? {
            title,
            description: data.description || '',
            image: data.image || '',
            url: data.url || href,
            siteName: data.siteName || '',
          }
        : data?.image
        ? {
            title: data.siteName || hostname,
            description: data.description || '',
            image: data.image,
            url: data.url || href,
            siteName: data.siteName || '',
          }
        : null;

    previewCache.set(href, preview);
    return preview;
  } catch {
    previewCache.set(href, null);
    return null;
  }
}
