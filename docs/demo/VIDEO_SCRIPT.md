# War Room — Demo video script (screenshots + examples)

**Author: kartiyea**  
**Length:** ~2–3 minutes  
**Example task used in all SS:** `Build a todo list web app with add, complete, and delete`

Use this script **while showing** the files in `docs/demo/screenshots/` or your live UI.

---

## Slide 0 — Title (optional)

**On screen:** Text only, or SS 01 blurred in background.

> "War Room — a local multi-agent coding arena. I'm **kartiyea**. This demo uses a **todo list** as the example, but you can type any task."

---

## SS 01 — `01-arena-overview.png` (0:00 – 0:35)

**Show:** Full arena home.

> "Screenshot one — the home screen. You see the pipeline: **Prompt Box** → **Group Chat** → four outputs: Plan, Code, Debug, Review."

> "For example, I've typed: *Build a todo list web app with add, complete, and delete.* That's the product request — not a built-in calculator template."

> "Below that, **Local LLM Runtime**: Ollama for chat and code, runner on port **8787** for real files and preview. Each role can use a different model — Architect and Builder on `qwen2.5-coder:7b` in this shot."

**Click / gesture:** Point at Run Agent Arena button (don't click yet).

---

## SS 02 — `02-model-registry.png` (0:35 – 1:05)

**Show:** Model registry panel.

> "Screenshot two — **Model registry**. Ollama reports nine models on disk. Per agent: green **Installed** or red **Missing**."

> "Example: Debugger wants `deepseek-coder:6.7b` but it's missing here — I'd run `ollama pull deepseek-coder:6.7b` before a serious demo, or assign Debugger the same 7B model as Builder."

> "When you run the arena, this panel shows **working** on the active agent — so you know *which model is actually running*, not guessing from logs."

---

## SS 03 — `03-prompt-and-runtime.png` (1:05 – 1:25)

**Show:** Prompt + endpoints + model fields.

> "Screenshot three — the controls. The **prompt** is any coding task. **GitHub source** is optional — empty means a clean workspace under `agent-runs/`."

> "Example settings for this todo demo: Ollama at localhost 11434, runner at 8787, parallel opening round on so all four agents introduce themselves at once."

---

## Debate process — Group Chat (1:25 – 1:55)

**Show:** Live **Agent Group Chat** after run, or SS `05-group-chat-debate.png` if you captured it.  
**Reference:** [DEBATE.md](./DEBATE.md)

> "Now the **arguing process**. Phase one: four opening statements — who does plan, code, debug, review."

> "Phase two — the fight. Architect **proposes** a static app. Builder **disagrees** — in our todo example, no React for a tiny app. Debugger **interrupts**: validate user input, no reckless eval. Refactor **agrees**: three files, one preview."

> "Architect **proposes** again with a revised plan. Builder **agrees** to implement. Watch the stats: proposals, disagreements, agreements — not theater, typed message kinds."

> "Phase three: the runner writes files while that context is set — PLAN, HTML, CSS, JS."

*(Scroll chat slowly so labels proposal / disagreement / interruption / agreement are visible.)*

---

## SS 04 / Live — Workspaces + preview (1:55 – 2:20)

**Show:** Workspaces + preview (was 1:50–2:20).

> "Each agent workspace shows their slice of the repo. Then the iframe — our **todo list** example: add, complete, delete."

**Show SS 04** `04-live-preview-todo.png` if not live.

> "Screenshot four — real preview. Add a task, complete it, delete it."

---

## Outro (2:20 – 2:40)

**Show:** SS 01 or credits card.

> "War Room by **kartiyea**: multi-agent debate, honest model status, real code generation for **any** prompt — not just one demo. Links and screenshots are in `docs/demo/`. Thanks for watching."

---

## Credits card

```text
War Room
by kartiyea

Example: todo list web app
Any prompt → real files → live preview

docs/demo/DEMO.md
```
