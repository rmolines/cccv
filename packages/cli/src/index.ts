#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import openBrowser from 'open';
import { startServer } from '@cccv/server';

function parseArgs(argv: string[]): {
  cwd: string;
  port?: number;
  noOpen: boolean;
  skipDynamic: boolean;
  help: boolean;
} {
  let cwd = process.cwd();
  let port: number | undefined;
  let noOpen = false;
  let skipDynamic = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--no-open') noOpen = true;
    else if (arg === '--skip-dynamic') skipDynamic = true;
    else if (arg === '--port' || arg === '-p') {
      const next = argv[++i];
      if (next) port = Number.parseInt(next, 10);
    } else if (arg.startsWith('--port=')) {
      port = Number.parseInt(arg.slice('--port='.length), 10);
    } else if (!arg.startsWith('-')) {
      cwd = resolve(arg);
    }
  }
  return { cwd, port, noOpen, skipDynamic, help };
}

function findUiDir(): string | undefined {
  const candidates: string[] = [];

  // 1) Compiled binary: ui/ sibling of process.execPath (when shipped as binary + ui dir)
  if (process.execPath) {
    const binDir = dirname(process.execPath);
    candidates.push(resolve(binDir, 'ui'));
  }

  // 2) `bun run` from source: import.meta.url-relative
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, 'ui'), resolve(here, '../ui/dist'));
  } catch {
    // ignore
  }

  // 3) Dev: walk up from cwd to find packages/ui/dist
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(resolve(dir, 'packages', 'ui', 'dist'));
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const HELP = `cccv — Claude Code Context Visualizer

Usage:
  cccv [path]              Open visualizer for the given project (default: cwd)

Options:
  -p, --port <n>           Port to bind (default: ephemeral)
      --no-open            Do not open the browser automatically
      --skip-dynamic       Skip the SDK-based dynamic capture (no Anthropic auth needed)
  -h, --help               Show help
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const uiDir = findUiDir();
  if (!uiDir) {
    console.warn('[cccv] warning: UI bundle not found — only API will be available');
  }

  const server = await startServer({
    cwd: args.cwd,
    port: args.port,
    uiDir,
    skipDynamic: args.skipDynamic,
  });

  console.log(`[cccv] cwd: ${args.cwd}`);
  console.log(`[cccv] server listening on ${server.url}`);
  if (uiDir) console.log(`[cccv] ui served from ${uiDir}`);

  if (!args.noOpen) {
    try {
      await openBrowser(server.url);
    } catch (err) {
      console.warn(`[cccv] could not open browser: ${err instanceof Error ? err.message : err}`);
    }
  }

  const shutdown = async () => {
    console.log('\n[cccv] shutting down…');
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[cccv] fatal:', err);
  process.exit(1);
});
