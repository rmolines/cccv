# cccv — agent guide

This is **cccv**, a local web UI that shows exactly what Claude Code is loading
into context for a project (auto-loaded `CLAUDE.md` / `CLAUDE.local.md`,
`@`-imports, merged `settings.json`, discovered skills, hooks, and SDK-resolved
system context). People run it when their Claude Code is acting weirdly and they
want to read the actual injected text.

If a user asks you to install, run, or debug their Claude Code with this repo,
follow the playbooks below.

## Install + run on this machine

The user's project to inspect is whatever directory their Claude Code is
already operating on. Default to `process.cwd()` if they don't say.

```bash
# 1. Bun is required.
bun --version || (curl -fsSL https://bun.sh/install | bash && exec $SHELL)

# 2. From this repo root:
bun install
bun run build          # produces ./packages/cli/dist/cccv + dist/ui

# 3. Run, pointing at the project to inspect:
./packages/cli/dist/cccv <project-path> --port 7421
```

Pick a stable port (`--port 7421`) so SSH tunnels stay valid across runs. The
default is ephemeral.

## Install + run on a remote server (SSH session)

The common case: the user's Claude Code lives on a remote box (e.g. a VPS) and
you are running there as their on-server agent. cccv detects `$SSH_CONNECTION`,
suppresses browser auto-open, and prints the exact `ssh -L` command the user
needs to run on their laptop.

Steps you (the agent) should take:

1. Verify bun: `bun --version` — install if missing.
2. Clone (if not already): `git clone https://github.com/rmolines/cccv.git /root/cccv` (or wherever).
3. `cd` into the clone, `bun install && bun run build`.
4. Start the server: `./packages/cli/dist/cccv <project-path> --port 7421`.
   - Use `<project-path>` = the directory the user wants inspected (their
     Claude Code project root, e.g. `/root/openclaw`). Ask if not obvious.
5. Read the `[cccv] To view in your local browser…` block from stdout and
   relay the **exact** `ssh -L …` line back to the user. They run it on their
   laptop and open `http://127.0.0.1:7421`.
6. Leave the server running. Tell the user how to stop it (`Ctrl-C` in the
   terminal where it's running, or `kill <pid>`).

Do **not** suggest `--host 0.0.0.0` unless the user explicitly cannot use SSH
port forwarding. It exposes the server unauthenticated to the network and the
README warns against it.

## Running as root with `CLAUDE_CODE_ALLOW_ROOT=1`

This is fine. cccv reads `$HOME/.claude/` and the project's `.claude/`. When
`$HOME=/root` (root user), cccv looks at `/root/.claude/` — same place the
user's Claude Code is reading from. No extra config needed.

## Debugging cccv itself

- `bun test` — runs all tests; the server tests in `packages/server/src/server.test.ts` exercise the HTTP API end-to-end.
- `bun run dev <path>` — runs the CLI from source against a project path, no compile step.
- `bun run typecheck` has known UI-package noise (workspace `@cccv/shared` resolution + missing vite types). cli + server typecheck cleanly after `bun install`.
- The "Injected" tab in the UI is the source of truth for what Claude Code auto-loads. If a file the user expects is missing, check `packages/capture/src/static/walker.ts` (memory file discovery) and `packages/capture/src/index.ts` (`@`-import expansion).

## Don't do

- Don't propose binding to all interfaces by default.
- Don't auto-open a PR or commit changes to the user's inspected project — cccv is read-only against the project under inspection.
- Don't fetch or send `.claude/` contents anywhere external. The whole point is local inspection.
