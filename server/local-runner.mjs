import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planMarkdown, resolveBuildPlan } from "./build-plan.mjs";
import { buildBundle } from "./generate.mjs";
import {
  agentSpeak,
  isOllamaReady,
  parseModelsParam,
  resolveOllamaEndpoint,
} from "./ollama.mjs";
import { inspectModelRegistry } from "./ollama-registry.mjs";
import { scriptedDebateMessages } from "./debate-script.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runsDir = path.join(root, "agent-runs");
const port = Number(process.env.WARROOM_RUNNER_PORT ?? 8787);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exec = (file, args, cwd) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${file} ${args.join(" ")} failed: ${stderr || error.message}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === "/api/health") {
    const ollamaEndpoint = resolveOllamaEndpoint(url.searchParams.get("ollama"));
    const ollama = await isOllamaReady(ollamaEndpoint);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ollama, ollamaEndpoint }));
    return;
  }

  if (url.pathname === "/api/models") {
    try {
      const ollamaEndpoint = resolveOllamaEndpoint(url.searchParams.get("ollama"));
      const models = parseModelsParam(url.searchParams.get("models"));
      const registry = await inspectModelRegistry(ollamaEndpoint, models);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, runnerOnline: true, ...registry }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return;
  }

  if (url.pathname === "/api/run") {
    const ollamaEndpoint = resolveOllamaEndpoint(url.searchParams.get("ollama"));
    const models = parseModelsParam(url.searchParams.get("models"));
    const parallelOpening = url.searchParams.get("parallel") !== "0";
    const forceScripted = url.searchParams.get("scripted") === "1";
    const ollama = !forceScripted && (await isOllamaReady(ollamaEndpoint));

    await streamRun(url.searchParams.get("task") ?? "", url.searchParams.get("source") ?? "", res, {
      ollamaEndpoint,
      models,
      ollama,
      parallelOpening,
    });
    return;
  }

  if (url.pathname.startsWith("/preview/")) {
    await servePreview(url.pathname, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Run: npm start (frees the port) or stop the other process.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`War Room local runner listening at http://127.0.0.1:${port}`);
});

function resolveWorkspacePath(runId) {
  const workspace = path.join(runsDir, runId, "workspace");
  if (existsSync(workspace)) {
    return workspace;
  }
  return path.join(runsDir, runId, "scientific-calculator");
}

async function streamRun(task, sourceRepo, res, config) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const { ollamaEndpoint, models, ollama, parallelOpening } = config;
  const plan = resolveBuildPlan(task, sourceRepo);
  const transcript = [];

  const emitActive = (agentId, activity) => {
    send("agent-active", { agentId, model: models[agentId], activity });
  };

  const speak = async (agentId, type, instruction, fallback) => {
    emitActive(agentId, "arena chat");
    const content = await agentSpeak({
      endpoint: ollamaEndpoint,
      models,
      agentId,
      task: plan.task,
      instruction,
      fallback,
      history: transcript,
      enabled: ollama,
    });
    transcript.push({ agentId, type, content });
    send("message", { agentId, type, content });
    return content;
  };

  const speakDynamic = async (agentId, instruction, fallback, resolveType) => {
    emitActive(agentId, "arena chat");
    const content = await agentSpeak({
      endpoint: ollamaEndpoint,
      models,
      agentId,
      task: plan.task,
      instruction,
      fallback,
      history: transcript,
      enabled: ollama,
    });
    const type = resolveType(content);
    transcript.push({ agentId, type, content });
    send("message", { agentId, type, content });
    return content;
  };

  const runArguingProcess = async () => {
    if (!ollama) {
      for (const msg of scriptedDebateMessages(plan)) {
        transcript.push(msg);
        send("message", msg);
        await sleep(280);
      }
      return;
    }

    await speak(
      "architect",
      "proposal",
      `Propose how to implement this task${plan.hasSourceRepo ? " using the GitHub seed" : ""}. Mention index.html, styles.css, app.js.`,
      plan.hasSourceRepo
        ? `I'll use ${plan.sourceRepo} as a seed, then shape a static app for: ${plan.task}`
        : `I'll build a fresh static prototype for: ${plan.task}`,
    );
    await speakDynamic(
      "builder",
      "Review the architect's proposal. Start with Disagree if it is over-engineered; otherwise Agree. One short paragraph.",
      "Disagree: skip React for this task — vanilla HTML/CSS/JS and localStorage are enough.",
      (c) => (c.toLowerCase().includes("disagree") ? "disagreement" : "agreement"),
    );
    await speak(
      "debugger",
      "interruption",
      "Interrupt with the top security or correctness risks for this task (input validation, XSS, edge cases).",
      "Interrupt: validate user input on add; never eval task text; handle empty strings.",
    );
    await speak(
      "refactor",
      "agreement",
      "Agree or refine the minimal file layout (three files, one preview).",
      "Agree: index.html + styles.css + app.js, one preview — no extra frameworks.",
    );
    await speak(
      "architect",
      "proposal",
      "Revise the plan after Builder and Debugger feedback. One paragraph.",
      "Revised: PLAN.md, then HTML shell, styles, app.js with persistence for the task.",
    );
    await speak(
      "builder",
      "agreement",
      "Confirm you will implement the revised plan.",
      "Agree — implementing the static bundle now.",
    );
    await speak(
      "debugger",
      "statement",
      "State what you will verify after code is written.",
      "I'll smoke-check add/complete/delete and empty-input cases.",
    );
    await speak(
      "refactor",
      "statement",
      "State how you will keep the bundle minimal in review.",
      "I'll avoid extra dependencies and keep CSS flat in review-notes.",
    );
    await sleep(200);
  };

  const runId = `run-${Date.now()}`;
  const appDir = path.join(runsDir, runId, plan.workspaceDir);
  const previewUrl = `http://127.0.0.1:${port}/preview/${runId}/`;

  try {
    send("meta", {
      runId,
      previewUrl,
      llmMode: ollama ? "ollama" : "scripted",
      buildMode: plan.mode,
      task: plan.task,
      ollamaEndpoint,
      models,
    });

    await rm(path.join(runsDir, runId), { recursive: true, force: true });
    await mkdir(path.dirname(appDir), { recursive: true });

    send("status", { message: `Workspace ready (${plan.mode} build)`, runId });
    await sleep(300);

    const planDoc = planMarkdown(plan);

    if (ollama) {
      const opening = [
        { agentId: "architect", instruction: "State your first move for this coding task in one concise message." },
        { agentId: "builder", instruction: "State how you will implement once the plan is clear." },
        { agentId: "debugger", instruction: "State what risks or bugs you will watch for." },
        { agentId: "refactor", instruction: "State what over-engineering you will prevent." },
      ];
      const fallbacks = {
        architect: plan.hasSourceRepo ? "I'll inspect the cloned repo and draft the file layout." : "I'll start a fresh static workspace for this task.",
        builder: "I'll implement index.html, styles.css, and app.js to match the task.",
        debugger: "I'll harden user input and edge cases before we ship.",
        refactor: "I'll keep the bundle minimal and preview-friendly.",
      };

      if (parallelOpening) {
        const parts = await Promise.all(
          opening.map(async (item) => ({
            agentId: item.agentId,
            type: "statement",
            content: await agentSpeak({
              endpoint: ollamaEndpoint,
              models,
              agentId: item.agentId,
              task: plan.task,
              instruction: item.instruction,
              fallback: fallbacks[item.agentId],
              history: [],
              enabled: ollama,
            }),
          })),
        );
        for (const agentId of ["architect", "builder", "debugger", "refactor"]) {
          const part = parts.find((row) => row.agentId === agentId);
          transcript.push(part);
          send("message", part);
        }
      } else {
        for (const item of opening) {
          await speak(item.agentId, "statement", item.instruction, fallbacks[item.agentId]);
        }
      }
      await sleep(200);
    }

    await runArguingProcess();

    send("agent-workspace", {
      agentId: "architect",
      title: "Planning workspace",
      status: "writing",
      activeFile: "PLAN.md",
      files: ["PLAN.md"],
      code: planDoc,
      terminal: plan.hasSourceRepo ? [`$ git clone ${plan.sourceRepo}`] : ["$ mkdir workspace"],
    });

    if (plan.hasSourceRepo) {
      send("workspace", {
        status: "writing",
        activeFile: "git clone",
        files: ["PLAN.md", "git clone"],
        code: `git clone --depth 1 ${plan.sourceRepo} workspace`,
        terminal: [`$ git clone --depth 1 ${plan.sourceRepo}`],
      });
      try {
        await exec("git", ["clone", "--depth", "1", plan.sourceRepo, path.basename(appDir)], path.dirname(appDir));
      } catch (error) {
        await mkdir(appDir, { recursive: true });
        await speak(
          "debugger",
          "interruption",
          "Explain that the GitHub clone failed and you are continuing in a clean workspace.",
          `Clone failed; continuing in an empty workspace. ${error instanceof Error ? error.message : ""}`,
        );
      }
    } else {
      await mkdir(appDir, { recursive: true });
      send("workspace", {
        status: "writing",
        activeFile: "PLAN.md",
        files: ["PLAN.md"],
        code: planDoc,
        terminal: ["$ init empty workspace"],
      });
    }
    await writeFile(path.join(appDir, "PLAN.md"), planDoc, "utf8");
    await sleep(400);

    await speak(
      "architect",
      "proposal",
      "Confirm the workspace approach and what the static bundle will deliver for this task.",
      `Workspace is ready. Building a ${plan.mode} static bundle for the task.`,
    );

    send("status", {
      message:
        ollama && plan.mode === "custom"
          ? "Generating real app code with Ollama (any task)..."
          : plan.mode === "calculator"
            ? "Building calculator..."
            : "Ollama offline — scaffold only",
      previewUrl,
    });

    emitActive("builder", "generating application code");

    const heartbeat = setInterval(() => {
      send("ping", { t: Date.now() });
    }, 12000);

    let bundle;
    try {
      bundle = await buildBundle({
        plan,
        endpoint: ollamaEndpoint,
        models,
        ollama,
        onProgress: (agentId, activity, model) => emitActive(agentId, activity),
      });
    } finally {
      clearInterval(heartbeat);
    }
    const { indexHtml, stylesCss, appJs, codeSource = "template" } = bundle;

    await writeFile(path.join(appDir, "index.html"), indexHtml, "utf8");
    send("agent-workspace", {
      agentId: "architect",
      title: "Planning workspace",
      status: "passed",
      activeFile: "index.html",
      files: await listPreviewFiles(appDir, ["PLAN.md", "index.html"]),
      code: indexHtml,
      terminal: ["$ write index.html"],
    });
    send("workspace", { status: "writing", activeFile: "index.html", files: ["index.html"], code: indexHtml, terminal: ["$ write index.html"] });
    await sleep(400);

    await speak(
      "builder",
      "agreement",
      "Describe what you implemented in HTML/CSS for this specific task (not a generic calculator unless asked).",
      `Implemented the UI structure and styles for: ${plan.task}`,
    );

    await writeFile(path.join(appDir, "styles.css"), stylesCss, "utf8");
    send("agent-workspace", {
      agentId: "builder",
      title: "Implementation workspace",
      status: "writing",
      activeFile: "styles.css",
      files: await listPreviewFiles(appDir, ["index.html", "styles.css"]),
      code: stylesCss,
      terminal: ["$ write styles.css"],
    });
    send("workspace", { status: "writing", activeFile: "styles.css", files: ["index.html", "styles.css"], code: stylesCss, terminal: ["$ write styles.css"] });
    await sleep(400);

    await speak(
      "debugger",
      "interruption",
      "Call out the riskiest behavior in app.js for this task and how you secured it.",
      `Reviewed app.js for input handling and edge cases on: ${plan.task}`,
    );

    await writeFile(path.join(appDir, "app.js"), appJs, "utf8");
    send("agent-workspace", {
      agentId: "debugger",
      title: "Debug workspace",
      status: "testing",
      activeFile: "app.js",
      files: await listPreviewFiles(appDir, ["index.html", "styles.css", "app.js"]),
      code: appJs,
      terminal: ["$ write app.js", "$ smoke-check preview"],
    });
    send("workspace", { status: "testing", activeFile: "app.js", files: ["index.html", "styles.css", "app.js"], code: appJs, terminal: ["$ write app.js"] });
    await sleep(400);

    await speak(
      "refactor",
      "agreement",
      "Confirm the final static bundle is minimal and matches the task.",
      `Shipped index.html + styles.css + app.js for: ${plan.task}`,
    );

    const reviewNotes = `# Review\n\nTask: ${plan.task}\nBuild mode: ${plan.mode}\n\n- Static files only\n- Preview: ${previewUrl}\n`;
    await writeFile(path.join(appDir, "review-notes.md"), reviewNotes, "utf8");

    const finalFiles = await listPreviewFiles(appDir, ["PLAN.md", "index.html", "styles.css", "app.js", "review-notes.md"]);
    const finalTerminal = [
      `task: ${plan.task}`,
      `mode: ${plan.mode}`,
      plan.hasSourceRepo ? `seed: ${plan.sourceRepo}` : "seed: none",
      "files ok",
      `preview: ${previewUrl}`,
      ollama ? "dialogue: ollama" : "dialogue: scripted",
      `code: ${codeSource}`,
    ];

    send("agent-workspace", {
      agentId: "refactor",
      title: "Review workspace",
      status: "passed",
      activeFile: "review-notes.md",
      files: finalFiles,
      code: reviewNotes,
      terminal: finalTerminal,
    });
    for (const agentId of ["architect", "builder", "debugger"]) {
      send("agent-workspace", {
        agentId,
        title:
          agentId === "architect" ? "Planning workspace" : agentId === "builder" ? "Implementation workspace" : "Debug workspace",
        status: "passed",
        activeFile: agentId === "architect" ? "index.html" : agentId === "builder" ? "styles.css" : "app.js",
        files: finalFiles,
        code: agentId === "architect" ? indexHtml : agentId === "builder" ? stylesCss : appJs,
        terminal: finalTerminal,
      });
    }
    send("workspace", { status: "passed", activeFile: "index.html", files: finalFiles, code: indexHtml, terminal: finalTerminal });
    await sleep(200);

    send("done", {
      runId,
      previewUrl,
      appDir,
      buildMode: plan.mode,
      task: plan.task,
      sourceRepo: plan.sourceRepo,
      llmMode: ollama ? "ollama" : "scripted",
      codeSource,
      outputs: {
        architect: {
          finalAction: "Plan and structure completed",
          finalOutput: summarizeAgent(transcript, "architect", `Plan for ${plan.mode} build`),
        },
        builder: {
          finalAction: "UI written to disk",
          finalOutput: summarizeAgent(transcript, "builder", "index.html + styles.css"),
        },
        debugger: {
          finalAction: "Logic and safety reviewed",
          finalOutput: summarizeAgent(transcript, "debugger", "app.js behavior checked"),
        },
        refactor: {
          finalAction: "Bundle finalized",
          finalOutput: summarizeAgent(transcript, "refactor", "Static preview ready"),
        },
      },
    });
  } catch (error) {
    send("run-error", { message: error instanceof Error ? error.message : String(error) });
  } finally {
    res.end();
  }
}

function summarizeAgent(transcript, agentId, fallback) {
  const latest = [...transcript].reverse().find((message) => message.agentId === agentId)?.content ?? fallback;
  return latest.length > 88 ? `${latest.slice(0, 85)}...` : latest;
}

async function listPreviewFiles(appDir, fallback) {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(appDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith("."))
      .slice(0, 10);
    return Array.from(new Set([...files, ...fallback]));
  } catch {
    return fallback;
  }
}

async function servePreview(urlPath, res) {
  const parts = urlPath.split("/").filter(Boolean);
  const runId = parts[1];
  const requested = parts.slice(2).join("/") || "index.html";
  const appRoot = path.normalize(resolveWorkspacePath(runId));
  const filePath = path.normalize(path.join(appRoot, requested));

  if (!filePath.startsWith(appRoot) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Preview file not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
  };
  res.writeHead(200, { "Content-Type": contentTypes[ext] ?? "text/plain; charset=utf-8" });
  res.end(await readFile(filePath));
}
