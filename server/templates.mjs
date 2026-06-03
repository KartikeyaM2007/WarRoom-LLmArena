export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function calculatorHtml(task) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scientific Calculator</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="calculator" aria-label="Scientific calculator">
      <section class="display-panel">
        <p class="task">${escapeHtml(task)}</p>
        <output id="expression" class="expression">0</output>
        <output id="result" class="result">0</output>
      </section>
      <section class="keys" aria-label="Calculator keys"></section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`;
}

export function calculatorCss() {
  return `:root {
  color: #111827;
  background: #f4f7fb;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
.calculator {
  width: min(440px, 100%);
  padding: 18px;
  border: 1px solid #d8dee9;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
}
.display-panel {
  min-height: 150px;
  padding: 18px;
  border-radius: 14px;
  background: #111827;
  color: #fff;
  text-align: right;
}
.task { margin: 0 0 18px; color: #93a4bd; font-size: 13px; text-align: left; }
.expression { display: block; min-height: 28px; color: #b8c4d6; font-size: 18px; }
.result { display: block; margin-top: 10px; font-size: 42px; font-weight: 800; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
button {
  min-height: 58px; border: 0; border-radius: 12px;
  background: #edf2f7; font-size: 18px; font-weight: 800; cursor: pointer;
}
.danger { background: #ffe1e1; color: #b42323; }
.equals { background: #2563eb; color: #fff; }`;
}

export function calculatorJs() {
  return `const keys = [
  ["AC","("," )","⌫"],["sin","cos","tan","÷"],["log","ln","√","×"],
  ["7","8","9","−"],["4","5","6","+"],["1","2","3","xʸ"],["0",".","π","="],
];
const panel = document.querySelector(".keys");
const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
let expression = "";
const map = { "÷": "/", "×": "*", "−": "-", "xʸ": "^", "√": "sqrt(", "π": "pi" };
for (const row of keys) {
  for (const label of row) {
    const b = document.createElement("button");
    b.textContent = label;
    if (label === "AC") { b.dataset.action = "clear"; b.className = "danger"; }
    else if (label === "⌫") b.dataset.action = "backspace";
    else if (label === "=") { b.dataset.action = "equals"; b.className = "equals"; }
    else b.dataset.token = map[label] ?? label;
    panel.appendChild(b);
  }
}
const replacements = [
  [/pi/g, "Math.PI"], [/sin\\(/g, "Math.sin("], [/cos\\(/g, "Math.cos("], [/tan\\(/g, "Math.tan("],
  [/log\\(/g, "Math.log10("], [/ln\\(/g, "Math.log("], [/sqrt\\(/g, "Math.sqrt("], [/\\^/g, "**"],
];
function render(v = null) {
  expressionEl.textContent = expression || "0";
  resultEl.textContent = v ?? "0";
}
function sanitize(input) {
  let c = input;
  for (const [p, r] of replacements) c = c.replace(p, r);
  if (!/^[0-9+\\-*/().\\sMathPIcosintalqrgE*]+$/.test(c)) throw new Error("Invalid");
  return c;
}
function calculate() {
  if (!expression) return;
  try {
    const v = Function('"use strict"; return (' + sanitize(expression) + ")")();
    if (!Number.isFinite(v)) throw new Error("bad");
    render(String(Number.parseFloat(v.toFixed(10))));
  } catch { resultEl.textContent = "Error"; }
}
panel.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.token) expression += b.dataset.token;
  if (b.dataset.action === "clear") expression = "";
  if (b.dataset.action === "backspace") expression = expression.slice(0, -1);
  if (b.dataset.action === "equals") calculate(); else render();
});
render();`;
}

export function genericHtml(task) {
  const isTodo = /todo|task list|checklist/i.test(task);
  const title = isTodo ? "Todo List" : "War Room App";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="app">
      <header>
        <p class="eyebrow">War Room build</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="task">${escapeHtml(task)}</p>
      </header>
      <div id="app" aria-live="polite"></div>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`;
}

export function genericCss() {
  return `:root {
  color: #111827;
  background: #f4f7fb;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; padding: 32px 20px; }
.app { max-width: 560px; margin: 0 auto; }
header {
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}
.eyebrow { margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
h1 { margin: 8px 0 0; font-size: 28px; }
.task { margin: 12px 0 0; color: #4b5563; line-height: 1.5; }
#app { margin-top: 16px; }
.todo-form { display: flex; gap: 8px; margin-bottom: 12px; }
.todo-form input {
  flex: 1; padding: 12px 14px; border: 1px solid #d1d5db;
  border-radius: 10px; font-size: 16px;
}
.todo-form button, .todo-list button {
  border: 0; border-radius: 10px; padding: 12px 16px;
  background: #2563eb; color: #fff; font-weight: 700; cursor: pointer;
}
.todo-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.todo-list li {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 14px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 10px;
}
.todo-list li.done span { text-decoration: line-through; color: #9ca3af; }
.todo-list .ghost { background: #f3f4f6; color: #374151; }
.note {
  padding: 16px; background: #fff; border: 1px solid #e5e7eb;
  border-radius: 12px; line-height: 1.6;
}`;
}

export function genericJs(task) {
  if (/todo|task list|checklist/i.test(task)) {
    return `const root = document.getElementById("app");
const form = document.createElement("form");
form.className = "todo-form";
form.innerHTML = '<input type="text" placeholder="Add a task..." required /><button type="submit">Add</button>';
const list = document.createElement("ul");
list.className = "todo-list";
root.append(form, list);
let items = JSON.parse(localStorage.getItem("warroom-todos") || "[]");
function save() { localStorage.setItem("warroom-todos", JSON.stringify(items)); }
function render() {
  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No tasks yet — add one above.";
    list.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    if (item.done) li.classList.add("done");
    const label = document.createElement("span");
    label.textContent = item.text;
    const actions = document.createElement("div");
    const toggle = document.createElement("button");
    toggle.className = "ghost";
    toggle.textContent = item.done ? "Undo" : "Done";
    toggle.onclick = () => { item.done = !item.done; save(); render(); };
    const remove = document.createElement("button");
    remove.className = "ghost";
    remove.textContent = "Delete";
    remove.onclick = () => { items = items.filter((x) => x.id !== item.id); save(); render(); };
    actions.append(toggle, remove);
    li.append(label, actions);
    list.appendChild(li);
  }
}
form.onsubmit = (e) => {
  e.preventDefault();
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;
  items.push({ id: crypto.randomUUID(), text, done: false });
  input.value = "";
  save();
  render();
};
render();`;
  }

  const safeTask = task.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `const root = document.getElementById("app");
const note = document.createElement("div");
note.className = "note";
note.innerHTML = \`
  <p><strong>Prototype ready.</strong> War Room generated a static shell for your task.</p>
  <p>Task: <code>${safeTask.replace(/</g, "&lt;")}</code></p>
  <p>Edit the prompt and optional GitHub seed to build something else.</p>
\`;
root.appendChild(note);`;
}

export function fallbackBundle(plan) {
  if (plan.mode === "calculator") {
    return {
      indexHtml: calculatorHtml(plan.task),
      stylesCss: calculatorCss(),
      appJs: calculatorJs(),
    };
  }
  return {
    indexHtml: genericHtml(plan.task),
    stylesCss: genericCss(),
    appJs: genericJs(plan.task),
  };
}

/** Honest placeholder when Ollama is off or generation failed — not a fake "AI" app. */
export function scaffoldBundle(task) {
  const safe = escapeHtml(task);
  return {
    indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generation needed</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="scaffold">
      <h1>Code generation did not run</h1>
      <p>Task: ${safe}</p>
      <p>Start Ollama and use a stronger coder model (7B+ recommended) then run the arena again for a real build.</p>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`,
    stylesCss: `body { font-family: system-ui, sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #111827; }
.scaffold { max-width: 520px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; }
.scaffold h1 { margin-top: 0; font-size: 22px; }
.scaffold p { line-height: 1.5; color: #4b5563; }`,
    appJs: `// No generated app logic — rerun with Ollama for task: ${JSON.stringify(task)}`,
  };
}
