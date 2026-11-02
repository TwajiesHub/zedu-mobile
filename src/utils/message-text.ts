import { CLIENT_BASE_URL } from '@/utils/client-url';
import {
  isVoiceMessageMedia,
  type VoiceMediaFields,
} from '@/utils/voice-message';

export type MessageTextSegment = {
  type: 'text' | 'link';
  content: string;
  url?: string;
};

export type MentionKind = 'user' | 'channel';

export type MessageRenderSegment =
  | { type: 'text'; content: string }
  | { type: 'link'; content: string; url: string }
  | {
      type: 'mention';
      label: string;
      userId?: string;
      mentionKind: MentionKind;
    }
  | { type: 'newline' };

export type TextMarks = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
};

export type RichMessageSegment =
  | { type: 'text'; content: string; marks?: TextMarks }
  | { type: 'link'; content: string; url: string; marks?: TextMarks }
  | {
      type: 'mention';
      label: string;
      userId?: string;
      mentionKind: MentionKind;
    }
  | { type: 'newline' }
  | { type: 'codeblock'; content: string }
  | {
      type: 'list';
      ordered: boolean;
      items: RichMessageSegment[][];
    };

const TOKEN_REGEX = /<\/?([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)\/?>|([^<]+)/g;

const getAttr = (attrs: string, name: string): string | undefined => {
  const match = attrs.match(
    new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
};

const mergeMarks = (base: TextMarks, next: TextMarks): TextMarks => ({
  ...base,
  ...next,
});

/** Bare http(s) / www URLs inside plain text (not already wrapped in <a>). */
const BARE_URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

const trimTrailingUrlPunctuation = (url: string): string =>
  url.replace(/[.,;:!?)}\]]+$/, '');

const normalizeAutolinkUrl = (raw: string): string => {
  const trimmed = trimTrailingUrlPunctuation(raw);
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

/** Push text and promote bare URLs to tappable link segments. */
const emitTextWithAutolinks = (
  out: RichMessageSegment[],
  content: string,
  marks: TextMarks,
) => {
  if (!content) {
    return;
  }

  // Keep URLs literal inside inline code.
  if (marks.code) {
    out.push({ type: 'text', content, marks: { ...marks } });
    return;
  }

  const hasMarks = marks.bold || marks.italic || marks.strike;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let found = false;

  BARE_URL_REGEX.lastIndex = 0;
  while ((match = BARE_URL_REGEX.exec(content)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      const piece = content.slice(lastIndex, match.index);
      out.push(
        hasMarks
          ? { type: 'text', content: piece, marks: { ...marks } }
          : { type: 'text', content: piece },
      );
    }

    const rawUrl = match[1];
    const url = normalizeAutolinkUrl(rawUrl);
    const label = trimTrailingUrlPunctuation(rawUrl);
    out.push(
      hasMarks
        ? { type: 'link', content: label, url, marks: { ...marks } }
        : { type: 'link', content: label, url },
    );
    lastIndex = match.index + rawUrl.length;
  }

  if (!found) {
    out.push(
      hasMarks
        ? { type: 'text', content, marks: { ...marks } }
        : { type: 'text', content },
    );
    return;
  }

  if (lastIndex < content.length) {
    const piece = content.slice(lastIndex);
    out.push(
      hasMarks
        ? { type: 'text', content: piece, marks: { ...marks } }
        : { type: 'text', content: piece },
    );
  }
};

const pushText = (
  out: RichMessageSegment[],
  content: string,
  marks: TextMarks,
) => {
  if (!content) {
    return;
  }

  // TipTap / pasted content may include literal markdown markers. Expand them
  // so titles like **Expected Result** render bold (same as web ReactMarkdown).
  if (!marks.bold && !marks.italic && !marks.strike && !marks.code) {
    const mdPattern =
      /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let found = false;

    while ((match = mdPattern.exec(content)) !== null) {
      found = true;
      if (match.index > last) {
        emitTextWithAutolinks(out, content.slice(last, match.index), {});
      }

      if (match[2] != null) {
        emitTextWithAutolinks(out, match[2], { bold: true, italic: true });
      } else if (match[3] != null) {
        emitTextWithAutolinks(out, match[3], { bold: true });
      } else if (match[4] != null) {
        emitTextWithAutolinks(out, match[4], { italic: true });
      } else if (match[5] != null) {
        emitTextWithAutolinks(out, match[5], { strike: true });
      } else if (match[6] != null) {
        emitTextWithAutolinks(out, match[6], { code: true });
      }

      last = match.index + match[0].length;
    }

    if (found) {
      if (last < content.length) {
        emitTextWithAutolinks(out, content.slice(last), {});
      }
      return;
    }
  }

  emitTextWithAutolinks(out, content, marks);
};

const pushInlineNewlines = (
  out: RichMessageSegment[],
  text: string,
  marks: TextMarks,
) => {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line) {
      pushText(out, line, marks);
    }
    if (index < lines.length - 1) {
      out.push({ type: 'newline' });
    }
  });
};

/**
 * Parses TipTap / mobile message HTML into rich segments with real text marks.
 * Avoids HTML→markdown (`**bold**`) which CommonMark often fails to re-parse.
 */
export const parseTiptapHtmlToRichSegments = (
  html: string,
): RichMessageSegment[] => {
  if (!html) {
    return [];
  }

  let source = html
    .replace(/(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+$/gi, '')
    .replace(/^(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+/gi, '');

  const root: RichMessageSegment[] = [];
  const markStack: TextMarks[] = [{}];
  let listStack: Array<{
    ordered: boolean;
    items: RichMessageSegment[][];
    current?: RichMessageSegment[];
  }> = [];

  const currentOut = (): RichMessageSegment[] => {
    const list = listStack[listStack.length - 1];
    if (list?.current) {
      return list.current;
    }
    return root;
  };

  const currentMarks = (): TextMarks => markStack[markStack.length - 1] || {};

  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(source)) !== null) {
    const [full, tagName, rawAttrs = '', textContent] = match;

    if (textContent != null && full === textContent) {
      pushInlineNewlines(
        currentOut(),
        decodeHtmlEntities(textContent),
        currentMarks(),
      );
      continue;
    }

    const tag = (tagName || '').toLowerCase();
    const attrs = rawAttrs || '';
    const isClose = full.startsWith('</');
    const isSelfClosing =
      /\/\s*>$/.test(full) || tag === 'br' || tag === 'hr' || tag === 'img';

    if (tag === 'br') {
      currentOut().push({ type: 'newline' });
      continue;
    }

    if (tag === 'p') {
      if (isClose) {
        const out = currentOut();
        if (out.length > 0 && out[out.length - 1].type !== 'newline') {
          out.push({ type: 'newline' });
        }
      }
      continue;
    }

    if (tag === 'div' || tag === 'blockquote') {
      if (isClose) {
        currentOut().push({ type: 'newline' });
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      if (!isClose) {
        listStack.push({ ordered: tag === 'ol', items: [] });
      } else {
        const list = listStack.pop();
        if (list) {
          if (list.current) {
            list.items.push(list.current);
            list.current = undefined;
          }
          currentOut().push({
            type: 'list',
            ordered: list.ordered,
            items: list.items,
          });
          currentOut().push({ type: 'newline' });
        }
      }
      continue;
    }

    if (tag === 'li') {
      const list = listStack[listStack.length - 1];
      if (!list) {
        continue;
      }
      if (!isClose) {
        if (list.current) {
          list.items.push(list.current);
        }
        list.current = [];
      } else if (list.current) {
        list.items.push(list.current);
        list.current = undefined;
      }
      continue;
    }

    if (tag === 'pre') {
      if (!isClose) {
        // Capture until </pre> manually
        const start = TOKEN_REGEX.lastIndex;
        const closeIdx = source.slice(start).toLowerCase().indexOf('</pre>');
        if (closeIdx >= 0) {
          const inner = source.slice(start, start + closeIdx);
          const code = decodeHtmlEntities(
            stripHtmlTags(inner.replace(/<br\s*\/?>/gi, '\n')),
          ).replace(/\n$/, '');
          currentOut().push({ type: 'codeblock', content: code });
          currentOut().push({ type: 'newline' });
          TOKEN_REGEX.lastIndex = start + closeIdx + '</pre>'.length;
        }
      }
      continue;
    }

    if (tag === 'code') {
      if (!isClose) {
        markStack.push(mergeMarks(currentMarks(), { code: true }));
      } else if (markStack.length > 1) {
        markStack.pop();
      }
      continue;
    }

    if (tag === 'strong' || tag === 'b') {
      if (!isClose) {
        markStack.push(mergeMarks(currentMarks(), { bold: true }));
      } else if (markStack.length > 1) {
        markStack.pop();
      }
      continue;
    }

    if (tag === 'em' || tag === 'i') {
      if (!isClose) {
        markStack.push(mergeMarks(currentMarks(), { italic: true }));
      } else if (markStack.length > 1) {
        markStack.pop();
      }
      continue;
    }

    if (tag === 's' || tag === 'strike' || tag === 'del') {
      if (!isClose) {
        markStack.push(mergeMarks(currentMarks(), { strike: true }));
      } else if (markStack.length > 1) {
        markStack.pop();
      }
      continue;
    }

    if (tag === 'a' && !isClose) {
      const href = getAttr(attrs, 'href') || '';
      const start = TOKEN_REGEX.lastIndex;
      const closeIdx = source.slice(start).toLowerCase().indexOf('</a>');
      if (closeIdx >= 0) {
        const inner = source.slice(start, start + closeIdx);
        const label = decodeHtmlEntities(stripHtmlTags(inner)).trim() || href;
        currentOut().push({
          type: 'link',
          content: label,
          url: href,
          marks: { ...currentMarks() },
        });
        TOKEN_REGEX.lastIndex = start + closeIdx + '</a>'.length;
      }
      continue;
    }

    if (tag === 'span' && !isClose) {
      const isMention =
        getAttr(attrs, 'data-type') === 'mention' ||
        /\bmention\b/i.test(getAttr(attrs, 'class') || '');

      if (isMention) {
        const start = TOKEN_REGEX.lastIndex;
        const closeIdx = source.slice(start).toLowerCase().indexOf('</span>');
        if (closeIdx >= 0) {
          const label =
            getAttr(attrs, 'data-label') ||
            decodeHtmlEntities(
              stripHtmlTags(source.slice(start, start + closeIdx)),
            ).replace(/^@/, '');
          const id = getAttr(attrs, 'data-id');
          const mentionKind = resolveMentionKind({
            mentionType: getAttr(attrs, 'data-mention-type'),
            id,
            label,
          });
          currentOut().push({
            type: 'mention',
            label,
            userId: mentionKind === 'channel' ? undefined : id,
            mentionKind,
          });
          TOKEN_REGEX.lastIndex = start + closeIdx + '</span>'.length;
        }
        continue;
      }

      // Non-mention span — ignore tag, keep processing children with same marks
      continue;
    }

    if (tag === 'span' && isClose) {
      continue;
    }

    if (tag.match(/^h[1-6]$/) && !isClose) {
      markStack.push(mergeMarks(currentMarks(), { bold: true }));
      continue;
    }
    if (tag.match(/^h[1-6]$/) && isClose) {
      if (markStack.length > 1) {
        markStack.pop();
      }
      currentOut().push({ type: 'newline' });
      continue;
    }

    // Unknown self-closing tags — skip
    if (isSelfClosing) {
      continue;
    }
  }

  // Trim trailing newlines
  while (root.length > 0 && root[root.length - 1].type === 'newline') {
    root.pop();
  }

  return root;
};

/** True when rich segments contain visible content. */
export const hasRichMessageContent = (
  segments: RichMessageSegment[],
): boolean => {
  return segments.some(segment => {
    if (segment.type === 'text' || segment.type === 'link') {
      return segment.content.length > 0;
    }
    if (segment.type === 'mention') {
      return Boolean(segment.label);
    }
    if (segment.type === 'codeblock') {
      return segment.content.length > 0;
    }
    if (segment.type === 'list') {
      return segment.items.some(item => hasRichMessageContent(item));
    }
    return false;
  });
};

export type ComposerMentionSegment =
  | { type: 'text'; content: string }
  | { type: 'userMention'; content: string }
  | { type: 'channelMention'; content: string };

export const isChannelMentionLabel = (label: string): boolean =>
  label.trim().toLowerCase() === 'channel';

export const resolveMentionKind = (options: {
  mentionType?: string;
  id?: string;
  label?: string;
}): MentionKind => {
  const mentionType = String(options.mentionType || '').toLowerCase();
  const id = String(options.id || '').toLowerCase();
  const label = String(options.label || '').toLowerCase();

  if (mentionType === 'channel' || id === 'channel' || label === 'channel') {
    return 'channel';
  }

  return 'user';
};

export const buildMentionHtmlTag = (mention: {
  id: string;
  label: string;
  type?: string;
}): string => {
  const mentionKind = resolveMentionKind({
    mentionType: mention.type,
    id: mention.id,
    label: mention.label,
  });
  const mentionClass =
    mentionKind === 'channel' ? 'mention mention-channel' : 'mention';

  return `<span class="${mentionClass}" data-type="mention" data-mention-type="${mentionKind}" data-id="${mention.id}" data-label="${mention.label}" data-mention-suggestion-char="@">@${mention.label}</span>`;
};

/** Highlights @channel vs @user mentions while composing channel messages. */
export const parseComposerMentionSegments = (
  text: string,
  mentions: Array<{ label: string; type?: string }> = [],
): ComposerMentionSegment[] => {
  if (!text) {
    return [];
  }

  const userLabels = mentions
    .filter(mention => resolveMentionKind(mention) !== 'channel')
    .map(mention => mention.label)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const segments: ComposerMentionSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const atIndex = text.indexOf('@', cursor);
    if (atIndex === -1) {
      segments.push({ type: 'text', content: text.slice(cursor) });
      break;
    }

    if (atIndex > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, atIndex) });
    }

    const rest = text.slice(atIndex);
    const channelMatch = rest.match(/^@channel(?=$|[\s.,!?;:])/i);
    if (channelMatch) {
      segments.push({ type: 'channelMention', content: channelMatch[0] });
      cursor = atIndex + channelMatch[0].length;
      continue;
    }

    let matchedUser = false;
    for (const label of userLabels) {
      const prefix = `@${label}`;
      if (
        rest.toLowerCase().startsWith(prefix.toLowerCase()) &&
        (rest.length === prefix.length ||
          /[\s.,!?;:]/.test(rest[prefix.length]))
      ) {
        segments.push({ type: 'userMention', content: prefix });
        cursor = atIndex + prefix.length;
        matchedUser = true;
        break;
      }
    }

    if (matchedUser) {
      continue;
    }

    segments.push({ type: 'text', content: '@' });
    cursor = atIndex + 1;
  }

  return segments;
};

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const ANCHOR_REGEX = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;

export const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const MENTION_TRIGGER_REGEX = /(?:^|\s)@([\w.\-_]*)$/;

/** Returns the active @mention query at the cursor, if any. */
export const getActiveMention = (
  text: string,
  cursorPos: number,
): { query: string; pos: number } | null => {
  const beforeCursor = text.slice(0, Math.max(0, cursorPos));
  const match = beforeCursor.match(MENTION_TRIGGER_REGEX);
  if (!match) {
    return null;
  }

  return {
    query: match[1] ?? '',
    pos: cursorPos,
  };
};

const stripHtmlTags = (text: string): string => text.replace(/<[^>]*>/g, '');

const prepareMessageHtmlForRender = (html: string): string =>
  html
    // Drop empty trailing/leading paragraphs the editor often appends
    .replace(/(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+$/gi, '')
    .replace(/^(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '')
    // Trailing <br> / empty lines become a visible blank row in RN Text
    .replace(/\n+$/g, '')
    .replace(/^\n+/g, '');

const appendTextSegments = (
  segments: MessageRenderSegment[],
  content: string,
) => {
  if (!content) {
    return;
  }

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line) {
      segments.push({ type: 'text', content: line });
    }
    if (index < lines.length - 1) {
      segments.push({ type: 'newline' });
    }
  });
};

/** Parses message HTML into renderable text, links, mentions, and line breaks. */
export const parseMessageHtmlForRender = (
  html: string,
): MessageRenderSegment[] => {
  if (!html) {
    return [];
  }

  const prepared = prepareMessageHtmlForRender(html);
  const parts = prepared.split(/(<span[^>]*>.*?<\/span>)/gi);
  const segments: MessageRenderSegment[] = [];

  parts.forEach(part => {
    if (!part) {
      return;
    }

    if (part.startsWith('<span')) {
      const labelMatch = part.match(/data-label="([^"]*)"/);
      const idMatch = part.match(/data-id="([^"]*)"/);
      const mentionTypeMatch = part.match(/data-mention-type="([^"]*)"/);
      const label = labelMatch?.[1] || '';
      const userId = idMatch?.[1];
      const mentionKind = resolveMentionKind({
        mentionType: mentionTypeMatch?.[1],
        id: userId,
        label,
      });

      segments.push({
        type: 'mention',
        label,
        userId: mentionKind === 'channel' ? undefined : userId,
        mentionKind,
      });
      return;
    }

    parseMessageTextWithLinks(part).forEach(segment => {
      if (segment.type === 'link' && segment.url) {
        segments.push({
          type: 'link',
          content: segment.content,
          url: segment.url,
        });
        return;
      }

      appendTextSegments(segments, segment.content);
    });
  });

  while (
    segments.length > 0 &&
    segments[segments.length - 1].type === 'newline'
  ) {
    segments.pop();
  }

  return segments;
};

/** Builds web-compatible HTML from plain text, preserving line breaks as paragraphs. */
export const buildMessageHtml = (content: string): string => {
  if (!content) {
    return '<p></p>';
  }

  return content
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('');
};

const parsePlainTextUrls = (text: string): MessageTextSegment[] => {
  const cleaned = decodeHtmlEntities(stripHtmlTags(text));
  if (!cleaned) {
    return [];
  }

  const segments: MessageTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: cleaned.slice(lastIndex, match.index),
      });
    }

    const rawUrl = match[1];
    const url = normalizeAutolinkUrl(rawUrl);
    const label = trimTrailingUrlPunctuation(rawUrl);
    segments.push({ type: 'link', content: label, url });
    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < cleaned.length) {
    segments.push({ type: 'text', content: cleaned.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: cleaned }];
};

/** Parses a message fragment (outside mention spans) into plain text and link segments. */
export const parseMessageTextWithLinks = (
  text: string,
): MessageTextSegment[] => {
  if (!text) {
    return [];
  }

  const segments: MessageTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  ANCHOR_REGEX.lastIndex = 0;
  while ((match = ANCHOR_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parsePlainTextUrls(text.slice(lastIndex, match.index)));
    }

    const url = match[1];
    const label = decodeHtmlEntities(stripHtmlTags(match[2])).trim() || url;
    segments.push({ type: 'link', content: label, url });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...parsePlainTextUrls(text.slice(lastIndex)));
  }

  return segments.length > 0 ? segments : parsePlainTextUrls(text);
};

const MENTION_SPAN_REGEX = /<span[^>]*data-label="([^"]*)"[^>]*>.*?<\/span>/gi;

/** True when the next thing after a mention, skipping formatting tags, is another mention. */
const NEXT_IS_MENTION_REGEX =
  /^(?:<(?!span)\/?[a-z][^>]*>)*<span[^>]*data-label=/i;

/** Plain-text message body for clipboard (mentions as @label, HTML stripped). */
export const getPlainMessageText = (html: string): string => {
  if (!html) {
    return '';
  }

  return decodeHtmlEntities(
    html
      // Keep a space between two mentions in a row (even with formatting tags
      // between them) so "@a@b" does not read like a single handle.
      .replace(
        MENTION_SPAN_REGEX,
        (match: string, label: string, offset: number, source: string) =>
          NEXT_IS_MENTION_REGEX.test(source.slice(offset + match.length))
            ? `@${label} `
            : `@${label}`,
      )
      .replace(ANCHOR_REGEX, (_, url: string, label: string) => {
        const text = stripHtmlTags(label).trim();
        return text || url;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** Single-line preview text for chat lists (HTML stripped, entities decoded). */
export const formatPreviewMessage = (html: string): string =>
  getPlainMessageText(html).replace(/\s+/g, ' ').trim();

type ChatListPreviewItem = {
  preview_message?: string | null;
  preview_thread?: unknown[] | null;
};

type ChatListPreviewMessage = {
  message?: string | null;
  created_at?: string | null;
  media?: unknown;
  file_data?: unknown;
};

/** Attachments off a last-message object (`media` is the API field; `file_data` is a legacy alias). */
const getPreviewMessageMedia = (
  message: ChatListPreviewMessage,
): VoiceMediaFields[] => {
  const attachments =
    (message.media as VoiceMediaFields[] | undefined) ??
    (message.file_data as VoiceMediaFields[] | undefined);
  return Array.isArray(attachments) ? attachments : [];
};

/**
 * Chats-list preview for a DM / group DM row.
 *
 * The backend renders the preview from the last message's attachment mime, and
 * mobile voice notes carry a video/mp4 mime (AAC in an m4a container), so the
 * server preview labels them "🎥 Video". When the newest message is a voice
 * note with no visible text, override the label with the audio one; everything
 * else keeps the server text so videos, images, files and GIFs are untouched
 * (issue #128).
 */
export const getChatListPreview = (item: ChatListPreviewItem): string => {
  const serverPreview = formatPreviewMessage(item.preview_message || '');

  const messages = Array.isArray(item.preview_thread)
    ? (item.preview_thread as ChatListPreviewMessage[])
    : [];
  if (messages.length === 0 || !serverPreview) {
    return serverPreview;
  }
  // pick the most recent message by date so the newest message is found regardless of order
  const newest = [...messages]
    .sort(
      (a, b) =>
        new Date(a?.created_at || 0).getTime() -
        new Date(b?.created_at || 0).getTime(),
    )
    .pop();
  if (!newest) {
    return serverPreview;
  }

  // Only media-only messages get relabelled; text messages keep the server text.
  if (formatPreviewMessage(newest.message || '')) {
    return serverPreview;
  }

  if (
    getPreviewMessageMedia(newest).length > 0 &&
    getPreviewMessageMedia(newest).every(isVoiceMessageMedia)
  ) {
    return '🎤 Voice message';
  }

  return serverPreview;
};

/** True when TipTap/mobile HTML has visible message body content. */
export const hasMessageContent = (html?: string | null): boolean => {
  if (!html) {
    return false;
  }

  const trimmed = html.trim();
  if (!trimmed || trimmed === '<p></p>') {
    return false;
  }

  return getPlainMessageText(trimmed).length > 0;
};

export const MENTION_HREF_PREFIX = 'zedu-mention://';

export type ParsedMentionHref = {
  mentionKind: MentionKind;
  id?: string;
  label: string;
};

/** Encodes a TipTap mention as a markdown link href. */
export const buildMentionHref = (options: {
  mentionKind: MentionKind;
  id?: string;
  label: string;
}): string => {
  const id = options.id || (options.mentionKind === 'channel' ? 'channel' : '');
  return `${MENTION_HREF_PREFIX}${options.mentionKind}/${encodeURIComponent(
    id,
  )}?label=${encodeURIComponent(options.label)}`;
};

/** Parses a zedu-mention:// href produced by tiptapHtmlToMarkdown. */
export const parseMentionHref = (href: string): ParsedMentionHref | null => {
  if (!href?.startsWith(MENTION_HREF_PREFIX)) {
    return null;
  }

  const rest = href.slice(MENTION_HREF_PREFIX.length);
  const match = rest.match(/^([^/?]+)\/([^?]*)(?:\?label=([^&]*))?/i);
  if (!match) {
    return null;
  }

  const mentionType = decodeURIComponent(match[1] || '');
  const id = decodeURIComponent(match[2] || '') || undefined;
  const label = decodeURIComponent(match[3] || '');
  const mentionKind = resolveMentionKind({ mentionType, id, label });

  return {
    mentionKind,
    id: mentionKind === 'channel' ? undefined : id,
    label,
  };
};

const applyInlineMarkdownMarks = (html: string): string => {
  let result = html;
  let previous = '';

  const wrapMark = (inner: string, open: string, close: string): string => {
    // CommonMark rejects emphasis when open/close markers touch whitespace.
    // TipTap often bolds a selection that includes a trailing space.
    const lead = inner.match(/^\s*/)?.[0] ?? '';
    const trail = inner.match(/\s*$/)?.[0] ?? '';
    const core = inner.slice(lead.length, inner.length - trail.length);
    if (!core) {
      return inner;
    }
    return `${lead}${open}${core}${close}${trail}`;
  };

  // Repeat until nested marks stabilize (e.g. <strong><em>x</em></strong>).
  while (result !== previous) {
    previous = result;
    result = result
      .replace(
        /<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
        (_m, _t, inner: string) => wrapMark(inner, '**', '**'),
      )
      .replace(
        /<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
        (_m, _t, inner: string) => wrapMark(inner, '*', '*'),
      )
      .replace(
        /<(s|strike|del)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
        (_m, _t, inner: string) => wrapMark(inner, '~~', '~~'),
      )
      .replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, (_m, inner: string) =>
        wrapMark(inner, '`', '`'),
      );
  }

  return result;
};

const convertListBlock = (html: string, ordered: boolean): string => {
  const items = [...html.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)];
  if (items.length === 0) {
    return '';
  }

  return `${items
    .map((match, index) => {
      const inner = match[1]
        .replace(/<\/?p(?:\s[^>]*)?>/gi, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .trim();
      const body = applyInlineMarkdownMarks(inner);
      const cleaned = decodeHtmlEntities(stripHtmlTags(body));
      const prefix = ordered ? `${index + 1}. ` : '- ';
      return `${prefix}${cleaned}`;
    })
    .join('\n')}\n\n`;
};

/**
 * Converts TipTap / mobile message HTML into markdown for
 * react-native-markdown-display. Mentions become zedu-mention:// links.
 */
export const tiptapHtmlToMarkdown = (html: string): string => {
  if (!html) {
    return '';
  }

  let result = html
    // Drop empty trailing/leading paragraphs the editor often appends
    .replace(/(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+$/gi, '')
    .replace(/^(?:<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)+/gi, '');

  // Mentions → markdown links with custom protocol
  result = result.replace(/<span\b[^>]*>[\s\S]*?<\/span>/gi, match => {
    if (
      !/data-type=["']mention["']/i.test(match) &&
      !/class=["'][^"']*mention/i.test(match)
    ) {
      return decodeHtmlEntities(stripHtmlTags(match));
    }

    const labelMatch = match.match(/data-label=["']([^"']*)["']/i);
    const idMatch = match.match(/data-id=["']([^"']*)["']/i);
    const mentionTypeMatch = match.match(/data-mention-type=["']([^"']*)["']/i);
    const label = labelMatch?.[1] || stripHtmlTags(match).replace(/^@/, '');
    const id = idMatch?.[1];
    const mentionKind = resolveMentionKind({
      mentionType: mentionTypeMatch?.[1],
      id,
      label,
    });

    return `[@${label}](${buildMentionHref({ mentionKind, id, label })})`;
  });

  // Fenced code blocks before inline <code>
  result = result.replace(
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, code: string) =>
      `\n\`\`\`\n${decodeHtmlEntities(stripHtmlTags(code)).replace(
        /\n$/,
        '',
      )}\n\`\`\`\n\n`,
  );
  result = result.replace(
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
    (_match, code: string) =>
      `\n\`\`\`\n${decodeHtmlEntities(stripHtmlTags(code)).replace(
        /\n$/,
        '',
      )}\n\`\`\`\n\n`,
  );

  // Anchors
  result = result.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, url: string, label: string) => {
      const text =
        decodeHtmlEntities(
          stripHtmlTags(applyInlineMarkdownMarks(label)),
        ).trim() || url;
      return `[${text}](${url})`;
    },
  );

  // Lists (TipTap nests <p> inside <li>)
  result = result.replace(
    /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
    (_match, inner: string) => convertListBlock(inner, false),
  );
  result = result.replace(
    /<ol\b[^>]*>([\s\S]*?)<\/ol>/gi,
    (_match, inner: string) => convertListBlock(inner, true),
  );

  result = applyInlineMarkdownMarks(result);

  // Blockquotes / headings (StarterKit may emit these rarely)
  result = result.replace(
    /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_match, inner: string) =>
      `${decodeHtmlEntities(stripHtmlTags(inner))
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n')}\n\n`,
  );
  result = result.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, inner: string) =>
      `${'#'.repeat(Number(level))} ${decodeHtmlEntities(
        stripHtmlTags(inner),
      ).trim()}\n\n`,
  );

  result = result
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p\b[^>]*>/gi, '\n\n')
    .replace(/<\/?p\b[^>]*>/gi, '')
    .replace(/<\/?div\b[^>]*>/gi, '')
    .replace(/<\/?span\b[^>]*>/gi, '');

  result = decodeHtmlEntities(stripHtmlTags(result));

  return result.replace(/\n{3,}/g, '\n\n').trim();
};

export type MessageShareContext = 'dm' | 'group_dm' | 'channel';

type BuildMessageShareLinkParams = {
  threadId: string;
  channelId: string;
  orgSlug?: string;
  context?: MessageShareContext;
};

/** Deep link to a message, aligned with Zedu web org-scoped routes. */
export const buildMessageShareLink = ({
  threadId,
  channelId,
  orgSlug,
  context = 'dm',
}: BuildMessageShareLinkParams): string => {
  const baseUrl = CLIENT_BASE_URL;
  const pathSegment =
    context === 'channel'
      ? 'channels'
      : context === 'group_dm'
      ? 'group-dms'
      : 'dms';

  if (orgSlug) {
    return `${baseUrl}/${encodeURIComponent(
      orgSlug,
    )}/${pathSegment}/${channelId}?thread_id=${threadId}`;
  }

  return `${baseUrl}/client/${pathSegment}/${channelId}?thread_id=${threadId}`;
};
