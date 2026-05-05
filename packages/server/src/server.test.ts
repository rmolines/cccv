import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from './index';

let dir: string;
let server: RunningServer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cccv-server-'));
  await writeFile(join(dir, 'CLAUDE.md'), 'project memory');
  // Set CCCV_TEST so capture skips dynamic SDK calls (we don't want network)
  // (captureSnapshot doesn't read this env yet — we'll add it via skipDynamic option)
  // For now just rely on no auth → graceful fail. The test still works because
  // captureSnapshot returns a Snapshot with warnings.
  // Spawn a server pointing at our tmp dir.
  // We pass cwd directly; uiDir omitted so static fallback returns 404.
  server = await startServer({ cwd: dir, port: 0, skipDynamic: true });
});

afterAll(async () => {
  await server.stop();
  await rm(dir, { recursive: true, force: true });
});

describe('server', () => {
  test('GET /api/snapshot returns Snapshot with our CLAUDE.md', async () => {
    const r = await fetch(`${server.url}/api/snapshot`);
    expect(r.status).toBe(200);
    const snap = await r.json() as { injections: { source: { path?: string } }[] };
    expect(snap.injections.some((i) => i.source.path === join(dir, 'CLAUDE.md'))).toBe(true);
  }, 30_000);

  test('GET /api/file returns content for an allowed path', async () => {
    const r = await fetch(
      `${server.url}/api/file?path=${encodeURIComponent(join(dir, 'CLAUDE.md'))}`,
    );
    expect(r.status).toBe(200);
    const body = await r.json() as { content: string };
    expect(body.content).toBe('project memory');
  });

  test('GET /api/file with traversal path returns 403', async () => {
    const r = await fetch(`${server.url}/api/file?path=/etc/passwd`);
    expect(r.status).toBe(403);
  });

  test('GET /api/file with missing path returns 400', async () => {
    const r = await fetch(`${server.url}/api/file`);
    expect(r.status).toBe(400);
  });

  test('GET /api/file rejects symlink escape', async () => {
    const escapeDir = await mkdtemp(join(tmpdir(), 'cccv-escape-'));
    try {
      await writeFile(join(escapeDir, 'secret.md'), 'leaked');
      const linkPath = join(dir, 'link.md');
      await symlink(join(escapeDir, 'secret.md'), linkPath);
      const r = await fetch(`${server.url}/api/file?path=${encodeURIComponent(linkPath)}`);
      expect(r.status).toBe(403);
    } finally {
      await rm(escapeDir, { recursive: true, force: true });
    }
  });

  test('unknown route returns 404', async () => {
    const r = await fetch(`${server.url}/api/nope`);
    expect(r.status).toBe(404);
  });

  test('POST /api/switch-cwd rejects missing path with 400', async () => {
    const r = await fetch(`${server.url}/api/switch-cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  test('POST /api/switch-cwd rejects relative path with 400', async () => {
    const r = await fetch(`${server.url}/api/switch-cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'relative/path' }),
    });
    expect(r.status).toBe(400);
  });

  test('POST /api/switch-cwd returns 404 for non-existent dir', async () => {
    const r = await fetch(`${server.url}/api/switch-cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/no/such/dir/cccv-test-bogus-12345' }),
    });
    expect(r.status).toBe(404);
  });

  test('POST /api/switch-cwd returns 400 for a file (not a directory)', async () => {
    const filePath = join(dir, 'CLAUDE.md');
    const r = await fetch(`${server.url}/api/switch-cwd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    expect(r.status).toBe(400);
  });

  test('POST /api/switch-cwd swaps cwd and returns new snapshot', async () => {
    const otherDir = await mkdtemp(join(tmpdir(), 'cccv-swap-'));
    try {
      await writeFile(join(otherDir, 'CLAUDE.md'), 'swapped memory');
      const r = await fetch(`${server.url}/api/switch-cwd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: otherDir }),
      });
      expect(r.status).toBe(200);
      const snap = (await r.json()) as { cwd: string; injections: { source: { path?: string } }[] };
      expect(snap.injections.some((i) => i.source.path === join(snap.cwd, 'CLAUDE.md'))).toBe(true);
    } finally {
      // Swap back so other tests aren't affected.
      await fetch(`${server.url}/api/switch-cwd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dir }),
      });
      await rm(otherDir, { recursive: true, force: true });
    }
  }, 30_000);
});
