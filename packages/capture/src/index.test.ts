import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSnapshot } from './index';

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'cccv-capture-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe('captureSnapshot (skipDynamic=true)', () => {
  test('captures CLAUDE.md from cwd as fs-static injection', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), 'project memory');
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const inj = snap.injections.find(
        (i) => i.origin === 'fs-static' && i.source.path === join(dir, 'CLAUDE.md'),
      );
      expect(inj).toBeDefined();
      expect(inj?.content).toBe('project memory');
      expect(inj?.tokenEstimate).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  test('expands recursive @import as child injection', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), '@./extra.md\n');
      await writeFile(join(dir, 'extra.md'), 'more memory');
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const parent = snap.injections.find((i) => i.source.path === join(dir, 'CLAUDE.md'))!;
      const child = snap.injections.find((i) => i.source.path === join(dir, 'extra.md'))!;
      expect(parent.imports?.[0]?.resolved).toBe(true);
      expect(child).toBeDefined();
      expect(child.parentId).toBe(parent.id);
      expect(child.content).toBe('more memory');
    } finally {
      await cleanup();
    }
  });

  test('records warning for unresolved @import', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), '@./missing.md\n');
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      expect(snap.warnings.some((w) => w.includes('Unresolved @import'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('captures path-scoped rule with notLoaded warning', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await mkdir(join(dir, '.claude', 'rules'), { recursive: true });
      await writeFile(
        join(dir, '.claude', 'rules', 'r.md'),
        '---\npaths: ["src/**/*.ts"]\n---\nrule body',
      );
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const ruleInj = snap.injections.find((i) => i.title.includes('path-scoped'));
      expect(ruleInj).toBeDefined();
      expect(snap.warnings.some((w) => w.includes('path-scoped'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('totalTokens is sum of tokenEstimate', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), 'a'.repeat(100));
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const sum = snap.injections.reduce((a, i) => a + i.tokenEstimate, 0);
      expect(snap.totalTokens).toBe(sum);
    } finally {
      await cleanup();
    }
  });

  test('AGENTS.md imported via @ does not duplicate as candidate', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), '@AGENTS.md\n');
      await writeFile(join(dir, 'AGENTS.md'), 'agent body');
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const agents = snap.injections.filter(
        (i) => i.source.path === join(dir, 'AGENTS.md'),
      );
      expect(agents).toHaveLength(1);
      expect(agents[0]!.title.includes('not auto-loaded')).toBe(false);
    } finally {
      await cleanup();
    }
  });

  test('AGENTS.md WITHOUT being imported still appears as candidate', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await writeFile(join(dir, 'CLAUDE.md'), 'no import here');
      await writeFile(join(dir, 'AGENTS.md'), 'agent body');
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const agents = snap.injections.filter(
        (i) => i.source.path === join(dir, 'AGENTS.md'),
      );
      expect(agents).toHaveLength(1);
      expect(agents[0]!.title.includes('not auto-loaded')).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('captures settings layers as parsed-runtime', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      await mkdir(join(dir, '.claude'), { recursive: true });
      await writeFile(
        join(dir, '.claude', 'settings.json'),
        JSON.stringify({ outputStyle: 'concise' }),
      );
      const snap = await captureSnapshot({ cwd: dir, skipDynamic: true });
      const setting = snap.injections.find(
        (i) => i.origin === 'parsed-runtime' && i.title.includes('settings: project'),
      );
      expect(setting).toBeDefined();
    } finally {
      await cleanup();
    }
  });
});
