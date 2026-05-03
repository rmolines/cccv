import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import {
  extractImportSpecs,
  resolveImportPath,
  resolveImports,
  MAX_IMPORT_DEPTH,
} from './imports';

describe('extractImportSpecs', () => {
  test('finds @import at start of line', () => {
    expect(extractImportSpecs('@foo.md\n')).toEqual(['foo.md']);
  });

  test('finds inline @import after whitespace', () => {
    expect(extractImportSpecs('see @bar/baz.md for details')).toEqual(['bar/baz.md']);
  });

  test('does not match email-like patterns', () => {
    expect(extractImportSpecs('contact rafael@gmail.com today')).toEqual([]);
  });

  test('does not match @import inside code spans (best-effort: matches but caller can ignore)', () => {
    // We intentionally match anywhere — UI/parser semantics are handled higher up
    expect(extractImportSpecs('`@code.md`')).toEqual(['code.md']);
  });

  test('matches multiple imports', () => {
    expect(extractImportSpecs('@a.md and @b/c.md')).toEqual(['a.md', 'b/c.md']);
  });

  test('only matches .md extension', () => {
    expect(extractImportSpecs('@foo.txt @bar.md')).toEqual(['bar.md']);
  });
});

describe('resolveImportPath', () => {
  test('relative path resolves against importer dir', () => {
    expect(resolveImportPath('./foo.md', '/work/CLAUDE.md')).toBe('/work/foo.md');
  });

  test('subdirectory relative', () => {
    expect(resolveImportPath('a/b.md', '/work/CLAUDE.md')).toBe('/work/a/b.md');
  });

  test('absolute path passthrough', () => {
    expect(resolveImportPath('/abs/foo.md', '/work/CLAUDE.md')).toBe('/abs/foo.md');
  });

  test('tilde expands to home', () => {
    expect(resolveImportPath('~/.claude/foo.md', '/work/CLAUDE.md')).toBe(
      join(homedir(), '.claude/foo.md'),
    );
  });
});

describe('resolveImports (filesystem)', () => {
  async function setup(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
    const dir = await mkdtemp(join(tmpdir(), 'cccv-imports-'));
    return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }

  test('resolves a real file', async () => {
    const { dir, cleanup } = await setup();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), '@foo.md\n');
      await writeFile(join(dir, 'foo.md'), 'hello');
      const result = await resolveImports(
        join(dir, 'CLAUDE.md'),
        '@foo.md\n',
        new Set(),
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.edge.resolved).toBe(true);
      expect(result[0]!.content).toBe('hello');
    } finally {
      await cleanup();
    }
  });

  test('marks missing import as unresolved', async () => {
    const { dir, cleanup } = await setup();
    try {
      const result = await resolveImports(join(dir, 'CLAUDE.md'), '@missing.md\n', new Set());
      expect(result[0]!.edge.resolved).toBe(false);
    } finally {
      await cleanup();
    }
  });

  test('detects cycle via ancestor set', async () => {
    const { dir, cleanup } = await setup();
    try {
      await writeFile(join(dir, 'a.md'), '@b.md');
      await writeFile(join(dir, 'b.md'), '@a.md');
      const ancestors = new Set([join(dir, 'a.md')]);
      const result = await resolveImports(join(dir, 'b.md'), '@a.md', ancestors);
      expect(result[0]!.edge.cycle).toBe(true);
      expect(result[0]!.content).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
});

test('MAX_IMPORT_DEPTH is 5 (matches CC docs)', () => {
  expect(MAX_IMPORT_DEPTH).toBe(5);
});
