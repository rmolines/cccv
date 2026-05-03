import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverMemoryFiles, discoverRules } from './walker';

async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'cccv-walker-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe('discoverMemoryFiles', () => {
  test('finds CLAUDE.md in cwd', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), 'project instructions');
      const files = await discoverMemoryFiles(dir);
      const cwdFile = files.find((f) => f.path === join(dir, 'CLAUDE.md'));
      expect(cwdFile).toBeDefined();
      expect(cwdFile?.autoLoaded).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('finds CLAUDE.local.md in cwd', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.local.md'), 'local');
      const files = await discoverMemoryFiles(dir);
      expect(files.some((f) => f.path === join(dir, 'CLAUDE.local.md'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('marks AGENTS.md as candidate (not auto-loaded)', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'AGENTS.md'), 'agent instructions');
      const files = await discoverMemoryFiles(dir);
      const agents = files.find((f) => f.path === join(dir, 'AGENTS.md'));
      expect(agents).toBeDefined();
      expect(agents?.autoLoaded).toBe(false);
      expect(agents?.notLoadedReason).toContain('AGENTS.md');
    } finally {
      await cleanup();
    }
  });

  test('returns empty list when no memory files exist in tmp dir', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      const files = await discoverMemoryFiles(dir);
      // Global ~/.claude/CLAUDE.md may exist on the host; we just verify no cwd-scoped ones leak
      const cwdScoped = files.filter((f) => f.path.startsWith(dir));
      expect(cwdScoped).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});

describe('discoverRules', () => {
  test('rule without paths frontmatter is auto-loaded', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await mkdir(join(dir, '.claude', 'rules'), { recursive: true });
      await writeFile(join(dir, '.claude', 'rules', 'global.md'), '# Global rule\nhi');
      const rules = await discoverRules(dir);
      const r = rules.find((x) => x.path === join(dir, '.claude', 'rules', 'global.md'));
      expect(r).toBeDefined();
      expect(r?.autoLoaded).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('rule with paths frontmatter is candidate', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await mkdir(join(dir, '.claude', 'rules'), { recursive: true });
      const fm = `---\npaths:\n  - "src/**/*.ts"\n---\n# Scoped\nhi`;
      await writeFile(join(dir, '.claude', 'rules', 'scoped.md'), fm);
      const rules = await discoverRules(dir);
      const r = rules.find((x) => x.path === join(dir, '.claude', 'rules', 'scoped.md'));
      expect(r).toBeDefined();
      expect(r?.autoLoaded).toBe(false);
      expect(r?.notLoadedReason).toContain('path-scoped');
    } finally {
      await cleanup();
    }
  });

  test('returns empty when no rules dir', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      const rules = await discoverRules(dir);
      // Global ~/.claude/rules may exist; we just check none leak from cwd
      const cwdRules = rules.filter((r) => r.path.startsWith(dir));
      expect(cwdRules).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
