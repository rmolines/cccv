import { readFile } from 'node:fs/promises';

export type TranscriptEntry = {
  /** Raw entry (kept for debugging) */
  raw: unknown;
  /** Normalized role */
  role: 'system' | 'user' | 'assistant' | 'tool' | 'unknown';
  /** Normalized text content (concatenation of all text parts) */
  text: string;
  /** Free-form subtype (e.g. 'system-reminder', 'system-message', 'startup-hook') */
  subtype?: string;
};

/**
 * The transcript JSONL format used by Claude Code stores one event per line.
 * Each line is a JSON object. Common shapes:
 *   { "type": "user" | "assistant" | "system", "message": { "content": [...] } }
 *   { "type": "system", "subtype": "session-start", "content": "..." }
 *   { "type": "summary" | "compact" | etc. }
 *
 * This parser is intentionally tolerant: it normalizes what it can recognize
 * and falls through unknown shapes to role='unknown' with a best-effort text.
 */
export function parseTranscriptLine(line: string): TranscriptEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  const type = typeof o.type === 'string' ? o.type : undefined;
  const subtype = typeof o.subtype === 'string' ? o.subtype : undefined;

  let role: TranscriptEntry['role'];
  switch (type) {
    case 'user':
      role = 'user';
      break;
    case 'assistant':
      role = 'assistant';
      break;
    case 'system':
      role = 'system';
      break;
    case 'tool_use':
    case 'tool_result':
      role = 'tool';
      break;
    default:
      role = 'unknown';
  }

  const text = extractText(o);
  return { raw: obj, role, text, subtype };
}

function extractText(o: Record<string, unknown>): string {
  // Some shapes: { content: "..." } or { content: [{ type: "text", text: "..." }] }
  // Or wrapped: { message: { content: ... } }
  const candidates: unknown[] = [];
  if ('content' in o) candidates.push(o.content);
  if (o.message && typeof o.message === 'object') {
    const msg = o.message as Record<string, unknown>;
    if ('content' in msg) candidates.push(msg.content);
  }
  for (const c of candidates) {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      const parts: string[] = [];
      for (const part of c) {
        if (typeof part === 'string') parts.push(part);
        else if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (typeof p.text === 'string') parts.push(p.text);
          else if (typeof p.content === 'string') parts.push(p.content);
        }
      }
      if (parts.length) return parts.join('\n\n');
    }
  }
  return '';
}

export function parseTranscript(text: string): TranscriptEntry[] {
  return text
    .split('\n')
    .map(parseTranscriptLine)
    .filter((x): x is TranscriptEntry => x !== null);
}

export type PreUserSlice = {
  systemEntries: TranscriptEntry[];
  /** Index of first user entry, or -1 if none found */
  firstUserIndex: number;
};

/**
 * Extract entries that occurred BEFORE the first user message.
 * These represent the "ambient" context CC injected at session start.
 */
export function extractPreUser(entries: TranscriptEntry[]): PreUserSlice {
  const firstUserIndex = entries.findIndex((e) => e.role === 'user');
  const upTo = firstUserIndex === -1 ? entries : entries.slice(0, firstUserIndex);
  // Keep only system / unknown entries (not assistant/tool, which would be empty pre-user anyway)
  const systemEntries = upTo.filter((e) => e.role === 'system' || e.role === 'unknown');
  return { systemEntries, firstUserIndex };
}

export async function readTranscript(path: string): Promise<TranscriptEntry[]> {
  const raw = await readFile(path, 'utf8');
  return parseTranscript(raw);
}
