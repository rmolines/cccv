import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { captureSnapshot } from '@cccv/capture';
import type { Snapshot } from '@cccv/shared';
import { authorizePath, buildResolvedAllowlist, type Allowlist } from './allowlist';
import { SseHub } from './sse';
import { createWatcher } from './watcher';

function watchPaths(cwd: string): string[] {
  const home = homedir();
  return [
    join(home, '.claude', 'CLAUDE.md'),
    join(home, '.claude', 'CLAUDE.local.md'),
    join(home, '.claude', 'settings.json'),
    join(home, '.claude', 'settings.local.json'),
    join(home, '.claude', 'rules'),
    join(cwd, 'CLAUDE.md'),
    join(cwd, 'CLAUDE.local.md'),
    join(cwd, 'AGENTS.md'),
    join(cwd, '.claude'),
  ];
}

export type StartServerOptions = {
  cwd: string;
  port?: number;
  /** Directory containing the built UI (index.html + assets/). Optional in dev mode. */
  uiDir?: string;
  /** Skip the SDK-based dynamic capture (useful for tests / no-auth environments). */
  skipDynamic?: boolean;
};

export type RunningServer = {
  port: number;
  url: string;
  stop: () => Promise<void>;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(), ...(init.headers ?? {}) },
  });
}

async function serveStatic(uiDir: string, urlPath: string): Promise<Response> {
  const safe = urlPath === '/' ? '/index.html' : urlPath;
  const target = resolve(uiDir, `.${safe}`);
  if (!target.startsWith(resolve(uiDir))) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const data = await readFile(target);
    const mime = MIME[extname(target)] ?? 'application/octet-stream';
    return new Response(data, { headers: { 'Content-Type': mime } });
  } catch {
    // SPA fallback: serve index.html for unknown paths under the SPA route
    if (!safe.includes('.')) {
      try {
        const data = await readFile(resolve(uiDir, 'index.html'));
        return new Response(data, { headers: { 'Content-Type': MIME['.html']! } });
      } catch {}
    }
    return new Response('not found', { status: 404 });
  }
}

export async function startServer(opts: StartServerOptions): Promise<RunningServer> {
  const { cwd, port = 0, uiDir, skipDynamic = false } = opts;
  const allowlist: Allowlist = await buildResolvedAllowlist(cwd);
  const sse = new SseHub();

  let snapshotCache: Snapshot | null = null;
  let snapshotInflight: Promise<Snapshot> | null = null;

  async function refreshSnapshot(): Promise<Snapshot> {
    if (snapshotInflight) return snapshotInflight;
    snapshotInflight = (async () => {
      const snap = await captureSnapshot({ cwd, skipDynamic });
      snapshotCache = snap;
      sse.publish({ kind: 'snapshot.replaced', snapshot: snap });
      return snap;
    })();
    try {
      return await snapshotInflight;
    } finally {
      snapshotInflight = null;
    }
  }

  // Initial capture happens on first request, not on startup, so the server
  // starts fast and the user gets immediate feedback in the browser.

  const watcher = createWatcher({
    paths: watchPaths(cwd),
    onChange: () => {
      // Debounce by simply collapsing concurrent refreshes via the inflight guard.
      void refreshSnapshot().catch(() => {});
    },
  });

  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (url.pathname === '/api/snapshot' && req.method === 'GET') {
        const snap = snapshotCache ?? (await refreshSnapshot());
        return jsonResponse(snap);
      }

      if (url.pathname === '/api/refresh' && req.method === 'POST') {
        const snap = await refreshSnapshot();
        return jsonResponse(snap);
      }

      if (url.pathname === '/api/file' && req.method === 'GET') {
        const requested = url.searchParams.get('path');
        if (!requested) return jsonResponse({ error: 'path required' }, { status: 400 });
        try {
          const real = await authorizePath(requested, allowlist);
          const content = await readFile(real, 'utf8');
          return jsonResponse({ path: real, content });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const status = msg === 'path not found' ? 404 : 403;
          return jsonResponse({ error: msg }, { status });
        }
      }

      if (url.pathname === '/api/events' && req.method === 'GET') {
        return sse.newStream();
      }

      // Static SPA
      if (uiDir && req.method === 'GET') {
        return serveStatic(uiDir, url.pathname);
      }

      return jsonResponse({ error: 'not found' }, { status: 404 });
    },
  });

  const boundPort = server.port ?? port;
  return {
    port: boundPort,
    url: `http://127.0.0.1:${boundPort}`,
    stop: async () => {
      await watcher.close();
      server.stop(true);
    },
  };
}
