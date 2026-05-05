import { describe, expect, test } from 'bun:test';
import type { Injection, Snapshot } from '@cccv/shared';
import { buildInjectedSections } from './tree';

function inj(partial: Partial<Injection> & Pick<Injection, 'id' | 'origin' | 'tokenEstimate'>): Injection {
  return {
    title: partial.title ?? `inj-${partial.id}`,
    source: partial.source ?? {},
    content: partial.content ?? '',
    ...partial,
  } as Injection;
}

function makeSnapshot(injections: Injection[], overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    capturedAt: new Date().toISOString(),
    cwd: '/proj',
    home: '/home/user',
    injections,
    totalTokens: injections.reduce((acc, i) => acc + i.tokenEstimate, 0),
    warnings: [],
    neighbors: [],
    ...overrides,
  };
}

describe('buildInjectedSections', () => {
  test('returns three sections keyed by scope', () => {
    const snap = makeSnapshot([
      inj({ id: 'a', origin: 'fs-static', tokenEstimate: 100, source: { path: '/proj/CLAUDE.md' } }),
      inj({ id: 'b', origin: 'fs-static', tokenEstimate: 50, source: { path: '/home/user/.claude/CLAUDE.md' } }),
      inj({ id: 'c', origin: 'parsed-runtime', tokenEstimate: 200, source: {}, title: 'settings: user' }),
    ]);
    const { sections } = buildInjectedSections(snap);
    expect(sections.map((s) => s.key)).toEqual(['project', 'global', 'runtime']);
  });

  test('sorts items inside each section by tokens desc', () => {
    const snap = makeSnapshot([
      inj({ id: 'small', origin: 'fs-static', tokenEstimate: 10, source: { path: '/proj/A.md' } }),
      inj({ id: 'big', origin: 'fs-static', tokenEstimate: 1000, source: { path: '/proj/B.md' } }),
      inj({ id: 'mid', origin: 'fs-static', tokenEstimate: 100, source: { path: '/proj/C.md' } }),
    ]);
    const { sections } = buildInjectedSections(snap);
    const project = sections.find((s) => s.key === 'project')!;
    expect(project.items.map((i) => i.id)).toEqual(['big', 'mid', 'small']);
  });

  test('excludes "(not auto-loaded)" candidates and "(path-scoped)" rules', () => {
    const snap = makeSnapshot([
      inj({ id: 'real', origin: 'fs-static', tokenEstimate: 50, source: { path: '/proj/CLAUDE.md' } }),
      inj({ id: 'cand', origin: 'fs-static', tokenEstimate: 50, source: { path: '/proj/AGENTS.md' }, title: 'AGENTS.md (not auto-loaded)' }),
      inj({ id: 'rule', origin: 'fs-static', tokenEstimate: 50, source: { path: '/proj/.claude/rules/r.md' }, title: 'rule: r.md (path-scoped)' }),
    ]);
    const { sections } = buildInjectedSections(snap);
    const ids = sections.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toContain('real');
    expect(ids).not.toContain('cand');
    expect(ids).not.toContain('rule');
  });

  test('reports per-section token totals', () => {
    const snap = makeSnapshot([
      inj({ id: 'p1', origin: 'fs-static', tokenEstimate: 30, source: { path: '/proj/A.md' } }),
      inj({ id: 'p2', origin: 'fs-static', tokenEstimate: 70, source: { path: '/proj/B.md' } }),
      inj({ id: 'g1', origin: 'fs-static', tokenEstimate: 200, source: { path: '/home/user/.claude/CLAUDE.md' } }),
    ]);
    const { sections } = buildInjectedSections(snap);
    expect(sections.find((s) => s.key === 'project')!.tokens).toBe(100);
    expect(sections.find((s) => s.key === 'global')!.tokens).toBe(200);
    expect(sections.find((s) => s.key === 'runtime')!.tokens).toBe(0);
  });

  test('reports the snapshot-wide max token weight', () => {
    const snap = makeSnapshot([
      inj({ id: 'a', origin: 'fs-static', tokenEstimate: 10, source: { path: '/proj/A.md' } }),
      inj({ id: 'b', origin: 'parsed-runtime', tokenEstimate: 999, source: {}, title: 'settings: user' }),
    ]);
    const { maxTokens } = buildInjectedSections(snap);
    expect(maxTokens).toBe(999);
  });
});
