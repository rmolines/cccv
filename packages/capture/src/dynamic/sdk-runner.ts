import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Locate a usable Claude Code CLI binary on the host. Bun's `--compile` ships
 * a single binary that excludes the SDK's optional native CLI dependency, so
 * we have to hand it a path to an installed `claude` binary at runtime.
 */
function findClaudeExecutable(): string | null {
  const env = process.env.CCCV_CLAUDE_PATH;
  if (env && existsSync(env)) return env;

  const candidates = [
    join(homedir(), '.local', 'bin', 'claude'),
    join(homedir(), '.bun', 'bin', 'claude'),
    join(homedir(), '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  // Also walk PATH for a 'claude' entry
  const PATH = process.env.PATH ?? '';
  for (const dir of PATH.split(delimiter)) {
    if (!dir) continue;
    candidates.push(join(dir, 'claude'));
  }

  for (const c of candidates) {
    try {
      const s = statSync(c);
      if (s.isFile() || s.isSymbolicLink()) return c;
    } catch {
      /* not present */
    }
  }
  return null;
}

export type CapturedHookResponse = {
  hookId: string;
  hookName: string;
  hookEvent: string;
  output: string;
  exitCode: number;
  outcome: string;
};

export type CapturedInit = {
  sessionId: string;
  cwd: string;
  tools: string[];
  mcpServers?: Array<{ name: string; status?: string }>;
  plugins?: Array<{ name: string; path?: string; source?: string }>;
};

export type DynamicCaptureResult = {
  hookResponses: CapturedHookResponse[];
  init: CapturedInit | null;
  durationMs: number;
  warnings: string[];
};

export type DynamicCaptureOptions = {
  cwd: string;
  /** Hard timeout in ms. Default 30s. */
  timeoutMs?: number;
};

/**
 * Spawn an ephemeral Claude Code session via the SDK and capture the
 * messages emitted during initialization:
 *   - `system/hook_response` for each settings-defined SessionStart hook
 *     (worktree-audit, vercel knowledge updates, superpowers, etc.)
 *   - `system/init` containing the full tools list, mcp servers, and plugins
 *
 * User-registered SDK hooks DO NOT fire for SessionStart in the current
 * SDK version — those events are owned by the underlying CC subprocess and
 * only settings-defined hooks participate. That's why we read the message
 * stream instead of registering callbacks.
 *
 * Failure modes:
 *   - No auth → query rejects; caller should warn-and-skip.
 *   - Timeout → AbortController fires; partial data returned.
 */
export async function runDynamicCapture(
  opts: DynamicCaptureOptions,
): Promise<DynamicCaptureResult> {
  const { cwd, timeoutMs = 30_000 } = opts;
  const start = Date.now();
  const warnings: string[] = [];
  const hookResponses: CapturedHookResponse[] = [];
  let init: CapturedInit | null = null;

  const abort = new AbortController();
  const timer = setTimeout(() => {
    warnings.push(`Dynamic capture exceeded ${timeoutMs}ms — aborted`);
    abort.abort();
  }, timeoutMs);

  try {
    const claudePath = findClaudeExecutable();
    const result = query({
      prompt: 'reply OK',
      options: {
        cwd,
        maxTurns: 1,
        abortController: abort,
        persistSession: false,
        ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
      },
    });

    for await (const m of result) {
      if (m.type !== 'system') continue;
      if (m.subtype === 'init') {
        const init_ = m as Record<string, unknown>;
        init = {
          sessionId: String(init_.session_id ?? ''),
          cwd: String(init_.cwd ?? cwd),
          tools: Array.isArray(init_.tools) ? (init_.tools as string[]) : [],
          mcpServers: Array.isArray(init_.mcp_servers)
            ? (init_.mcp_servers as Array<{ name: string; status?: string }>)
            : undefined,
          plugins: Array.isArray(init_.plugins)
            ? (init_.plugins as Array<{ name: string; path?: string; source?: string }>)
            : undefined,
        };
      } else if (m.subtype === 'hook_response') {
        const r = m as Record<string, unknown>;
        const event = String(r.hook_event ?? '');
        // Only SessionStart-related hooks contribute to "ambient at session start"
        if (event !== 'SessionStart') continue;
        hookResponses.push({
          hookId: String(r.hook_id ?? ''),
          hookName: String(r.hook_name ?? ''),
          hookEvent: event,
          output: typeof r.output === 'string' ? r.output : '',
          exitCode: typeof r.exit_code === 'number' ? r.exit_code : -1,
          outcome: String(r.outcome ?? ''),
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!abort.signal.aborted) {
      throw new Error(`Claude Agent SDK session failed: ${msg}`);
    }
  } finally {
    clearTimeout(timer);
  }

  return { hookResponses, init, durationMs: Date.now() - start, warnings };
}
