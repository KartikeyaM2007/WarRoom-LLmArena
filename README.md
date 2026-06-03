# WarRoom-LLmArena

**Author: [kartiyea](docs/demo/AUTHOR.md)**

A local multi-agent coding arena. Four roles debate a task while a runner can clone a GitHub seed, write a real static app to disk, and serve a live preview.

**Demo (kartiyea):** [Walkthrough + screenshots](docs/demo/DEMO.md) · [How agents argue](docs/demo/DEBATE.md) · [Video script](docs/demo/VIDEO_SCRIPT.md) · `npm run demo:capture`

| Agent | Role |
|-------|------|
| Architect | Plans structure and file layout |
| Builder | Implements UI and application logic |
| Debugger | Hardens risky paths (e.g. expression evaluation) |
| Refactor | Keeps the bundle minimal and reviewable |

## Quick start

```bash
npm install
npm start
```

Then open [http://localhost:5173/](http://localhost:5173/) and click **Run Agent Arena**.

`npm start` runs both:

- **UI** — Vite on port `5173`
- **Local runner** — Node server on port `8787` (clones repo, writes files, streams SSE, serves preview)

### Run services separately

```bash
npm run runner   # http://127.0.0.1:8787
npm run dev      # http://localhost:5173
```

## What happens when you run the arena

1. **Local runner (default)** — Connects to `http://127.0.0.1:8787`, runs a **debate phase** (opening statements → proposal → disagreement/interruption → agreement → revised plan), then writes files under `agent-runs/run-<id>/`, streams per-agent workspaces, and embeds a live preview. With **Ollama**, agents argue from the shared transcript; without it, the same message types play from a scripted sequence ([DEBATE.md](docs/demo/DEBATE.md)).
2. **Ollama-only (fallback)** — If the runner is down, the UI calls Ollama directly for a debate (no disk writes / preview).
3. **Demo (fallback)** — If both runner and Ollama fail, plays a scripted calculator debate with sample workspaces.

## Tasks (not just a calculator)

The runner reads **your prompt** and picks a build mode:

| Mode | When |
|------|------|
| **custom** | Default — **any prompt**. With Ollama, the runner **generates** real `index.html` / `styles.css` / `app.js` (retries, then single-file HTML if needed). Without Ollama you get an honest scaffold, not a fake demo app. |
| **calculator** | Only when the prompt or optional GitHub URL mentions a calculator |

**Examples**

- `Build a todo list web app with add, complete, and delete` (default)
- `Build a scientific calculator with safe expression evaluation` (+ optional [calculator seed](https://github.com/GZ30eee/Scientific-Calculator.git))

Leave **GitHub source repo** empty for a blank workspace, or paste any static-friendly repo URL.

## Optional: Ollama debate mode

Install [Ollama](https://ollama.com), then pull small coding models:

```bash
ollama pull qwen2.5-coder:1.5b
ollama pull deepseek-coder:1.3b
ollama pull codegemma:2b
```

Keep the endpoint at `http://127.0.0.1:11434`. The UI passes this endpoint and per-agent models to the runner. Use **Parallel opening round** to fan out the first four messages when Ollama is active.

For **real code on arbitrary tasks**, use a stronger model for **Builder** (e.g. `qwen2.5-coder:7b`, `deepseek-coder:6.7b`). Small 1–2B models often fail validation; the terminal shows `code: ollama` only when generation actually succeeded.

Runner health check: `http://127.0.0.1:8787/api/health?ollama=http://127.0.0.1:11434`

## Build

```bash
npm run build
npm run preview
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/main.tsx` | Arena UI, Ollama orchestration, runner client |
| `server/local-runner.mjs` | SSE runner, git clone, file writes, preview server, Ollama dialogue |
| `server/ollama.mjs` | Ollama helpers used by the runner |
| `agent-runs/` | Generated run output (gitignored) |
| `.cursor/rules/karpathy-guidelines.mdc` | Agent behavioral guidelines in Cursor |

See [CURSOR.md](CURSOR.md) for Cursor setup.

## Cursor

Karpathy-inspired agent guidelines apply via a committed project rule. See [CURSOR.md](CURSOR.md).
