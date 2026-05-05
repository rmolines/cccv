# cccv — Claude Code Context Visualizer

A local web UI that shows exactly what Claude Code is loading into context for a project: auto-loaded memory files (`CLAUDE.md`, `CLAUDE.local.md`), `@`-imports, merged `settings.json`, discovered skills, hooks, and SDK-resolved system context.

Useful for: "why is Claude acting weirdly on this repo?" — you can see every byte of context being injected, where it comes from, and how much of the budget it's eating.

## Install (local Mac/Linux)

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
git clone <this-repo> cccv
cd cccv
bun install
bun run build           # produces packages/cli/dist/cccv (binary) + dist/ui
```

Then run from any project directory:

```bash
./cccv/packages/cli/dist/cccv /path/to/your/project
```

Or, without compiling, run from source:

```bash
bun run dev /path/to/your/project
```

## Remote use (over SSH)

If your Claude Code lives on a remote server (e.g. you `ssh root@host` and run `claude` there), you can run cccv on the remote and view the UI through an SSH tunnel — no need to expose any ports publicly.

### One-time setup on the remote server

```bash
ssh root@157.230.93.75
curl -fsSL https://bun.sh/install | bash      # if bun is not installed
exec $SHELL                                    # reload PATH so `bun` is on it
git clone <this-repo> /root/cccv
cd /root/cccv
bun install
bun run build
```

### Each session

On the **remote server** (inside SSH):

```bash
cd /root/cccv
./packages/cli/dist/cccv /root/openclaw --port 7421
```

cccv auto-detects `$SSH_CONNECTION` and skips the browser-open. It prints the exact tunnel command to use.

On your **local machine**, in another terminal:

```bash
ssh -L 7421:127.0.0.1:7421 root@157.230.93.75
```

Then open <http://127.0.0.1:7421> in your local browser. Leave both terminals running.

### Notes for `CLAUDE_CODE_ALLOW_ROOT=1` users

cccv reads files under `$HOME/.claude/` and the project's `.claude/`. When you're running as root with `CLAUDE_CODE_ALLOW_ROOT=1`, `$HOME` is `/root`, so cccv will look at `/root/.claude/` automatically — same place Claude Code is reading from. No extra config needed.

### Binding to all interfaces (not recommended)

If you really cannot use SSH port forwarding, you can expose the server on all interfaces with `--host 0.0.0.0`. **This is unauthenticated** — anyone who can reach the port can read your `.claude/` files. Prefer the SSH tunnel above; if you must do this, also restrict the port at the firewall.

```bash
./packages/cli/dist/cccv /root/openclaw --port 7421 --host 0.0.0.0
```

## Flags

```
cccv [path]                   Project to inspect (default: cwd)
  -p, --port <n>              Port to bind (default: ephemeral; pick a stable one for SSH tunnels)
      --host <addr>           Bind address (default: 127.0.0.1)
      --no-open               Don't auto-open a browser (auto-disabled over SSH)
      --skip-dynamic          Skip the SDK-based dynamic capture (no Anthropic auth needed)
  -h, --help                  Show help
```

## Troubleshooting

- **`UI bundle not found`** — run `bun run build` first, or use `bun run dev` to serve from source.
- **`tunnel: connect failed`** — make sure the remote `cccv` is still running, and that the local-side port (`-L 7421:...`) isn't already in use locally.
- **No memory files visible** — check the `Injected` tab; if it's empty for a project that does have `CLAUDE.md`, run with `--skip-dynamic` removed and verify `cccv` was started from a directory with read access to `~/.claude/` and the project's `.claude/`.
