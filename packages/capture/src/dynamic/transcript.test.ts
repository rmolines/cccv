import { describe, expect, test } from 'bun:test';
import { extractPreUser, parseTranscript, parseTranscriptLine } from './transcript';

describe('parseTranscriptLine', () => {
  test('returns null for empty line', () => {
    expect(parseTranscriptLine('')).toBeNull();
    expect(parseTranscriptLine('  \n')).toBeNull();
  });

  test('returns null for invalid JSON', () => {
    expect(parseTranscriptLine('{not json')).toBeNull();
  });

  test('parses user message with string content', () => {
    const e = parseTranscriptLine('{"type":"user","message":{"content":"hello"}}')!;
    expect(e.role).toBe('user');
    expect(e.text).toBe('hello');
  });

  test('parses system message with subtype', () => {
    const e = parseTranscriptLine(
      '{"type":"system","subtype":"session-start","content":"Hi"}',
    )!;
    expect(e.role).toBe('system');
    expect(e.subtype).toBe('session-start');
    expect(e.text).toBe('Hi');
  });

  test('parses array content with text parts', () => {
    const e = parseTranscriptLine(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"a"},{"type":"text","text":"b"}]}}',
    )!;
    expect(e.role).toBe('assistant');
    expect(e.text).toBe('a\n\nb');
  });

  test('unknown type → role=unknown', () => {
    const e = parseTranscriptLine('{"type":"summary","content":"x"}')!;
    expect(e.role).toBe('unknown');
    expect(e.text).toBe('x');
  });
});

describe('parseTranscript', () => {
  test('skips empty lines and parses rest', () => {
    const t = `
{"type":"system","content":"a"}

{"type":"user","message":{"content":"hi"}}
`;
    const entries = parseTranscript(t);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.role).toBe('system');
    expect(entries[1]!.role).toBe('user');
  });
});

describe('extractPreUser', () => {
  test('returns system entries before first user', () => {
    const entries = parseTranscript(
      [
        '{"type":"system","subtype":"reminder","content":"R1"}',
        '{"type":"system","subtype":"reminder","content":"R2"}',
        '{"type":"user","message":{"content":"hi"}}',
        '{"type":"system","subtype":"reminder","content":"after"}',
      ].join('\n'),
    );
    const { systemEntries, firstUserIndex } = extractPreUser(entries);
    expect(firstUserIndex).toBe(2);
    expect(systemEntries).toHaveLength(2);
    expect(systemEntries[0]!.text).toBe('R1');
    expect(systemEntries[1]!.text).toBe('R2');
  });

  test('handles transcripts with no user message', () => {
    const entries = parseTranscript('{"type":"system","content":"x"}');
    const { systemEntries, firstUserIndex } = extractPreUser(entries);
    expect(firstUserIndex).toBe(-1);
    expect(systemEntries).toHaveLength(1);
  });
});
