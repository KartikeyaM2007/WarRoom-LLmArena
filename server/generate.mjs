import { askOllamaCode } from "./ollama.mjs";
import { fallbackBundle, scaffoldBundle } from "./templates.mjs";
import { extractArtifact, validateFile, isValidHtml } from "./validate-artifact.mjs";

const MAX_ATTEMPTS = 3;
const SNIPPET = (text, max = 2800) => (text.length > max ? `${text.slice(0, max)}\n/* truncated */` : text);

const FILE_RULES = {
  "index.html":
    "Write a COMPLETE index.html (at least 40 lines). Include full UI markup for the task, not a stub. Link ./styles.css and ./app.js.",
  "styles.css":
    "Write a COMPLETE styles.css (at least 60 lines). Style every UI element from the HTML. Modern layout, spacing, colors.",
  "app.js":
    "Write a COMPLETE app.js (at least 120 lines). Vanilla JS only. Full interactivity for the task — no stubs, no TODOs, no pseudo-code.",
};

async function generateWithRetries({ endpoint, model, task, filename, instruction, onAttempt }) {
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt);
    try {
      const raw = await askOllamaCode(
        endpoint,
        model,
        `${instruction}

${FILE_RULES[filename] ?? ""}

Task: ${task}
File: ${filename}
Attempt: ${attempt}/${MAX_ATTEMPTS}
Previous failure: ${lastReason}
Output ONLY raw ${filename} contents.`,
      );
      const content = extractArtifact(raw, filename);
      if (validateFile(filename, content)) {
        return content;
      }
      lastReason = `too short or invalid (${content.length} chars)`;
      console.warn(`[generate] ${filename} attempt ${attempt}: ${lastReason}`);
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
      console.warn(`[generate] ${filename} attempt ${attempt}: ${lastReason}`);
    }
  }
  return null;
}

async function trySingleFileApp(endpoint, model, task, onAttempt) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt);
    try {
      const raw = await askOllamaCode(
        endpoint,
        model,
        `Task: ${task}
Write ONE complete index.html (minimum 150 lines) with <!DOCTYPE html>, embedded <style> and <script>.
Implement the FULL application — all UI and behavior. No placeholders.
Attempt: ${attempt}/${MAX_ATTEMPTS}
Output ONLY raw HTML.`,
      );
      const content = extractArtifact(raw, "index.html");
      if (isValidHtml(content) && /<script/i.test(content) && content.length > 400) {
        return {
          indexHtml: content,
          stylesCss: "/* Styles are inline in index.html for this run */",
          appJs: "// Logic is inline in index.html for this run",
          codeSource: "ollama-single-file",
        };
      }
    } catch (error) {
      console.warn(`[generate] single-file attempt ${attempt}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return null;
}

async function buildMultiFile({ plan, endpoint, models, onProgress }) {
  const task = plan.task;
  const model = models.builder;

  onProgress?.("builder", "writing index.html", model);
  const indexHtml = await generateWithRetries({
    endpoint,
    model,
    task,
    filename: "index.html",
    instruction: "Create index.html for the task.",
    onAttempt: (n) => onProgress?.("builder", `index.html attempt ${n}`, model),
  });
  if (!indexHtml) {
    return null;
  }

  onProgress?.("builder", "writing styles.css", model);
  const stylesCss = await generateWithRetries({
    endpoint,
    model,
    task,
    filename: "styles.css",
    instruction: `Create styles.css for the same app. Match this HTML:\n${SNIPPET(indexHtml)}`,
    onAttempt: (n) => onProgress?.("builder", `styles.css attempt ${n}`, model),
  });

  onProgress?.("builder", "writing app.js", model);
  const appJs = await generateWithRetries({
    endpoint,
    model,
    task,
    filename: "app.js",
    instruction: `Create app.js implementing the full task. Must work with:\n${SNIPPET(indexHtml)}\n${
      stylesCss ? `CSS:\n${SNIPPET(stylesCss, 1000)}` : ""
    }`,
    onAttempt: (n) => onProgress?.("builder", `app.js attempt ${n}`, model),
  });

  if (!stylesCss || !appJs) {
    return null;
  }

  return {
    indexHtml,
    stylesCss,
    appJs,
    codeSource: "ollama",
  };
}

export async function buildBundle({ plan, endpoint, models, ollama, onProgress }) {
  if (!ollama) {
    if (plan.mode === "calculator") {
      const bundle = fallbackBundle(plan);
      return { ...bundle, codeSource: "calculator-template" };
    }
    return { ...scaffoldBundle(plan.task), codeSource: "scaffold" };
  }

  if (plan.mode === "calculator") {
    const generated = await buildMultiFile({ plan, endpoint, models, onProgress });
    if (generated) {
      return generated;
    }
    const bundle = fallbackBundle(plan);
    return { ...bundle, codeSource: "calculator-template" };
  }

  const multi = await buildMultiFile({ plan, endpoint, models, onProgress });
  if (multi) {
    return multi;
  }

  onProgress?.("builder", "trying single-file HTML", models.builder);
  const single = await trySingleFileApp(endpoint, models.builder, plan.task, (n) =>
    onProgress?.("builder", `single-file attempt ${n}`, models.builder),
  );
  if (single) {
    return single;
  }

  console.warn("[generate] Ollama could not produce valid code for this task");
  return { ...scaffoldBundle(plan.task), codeSource: "generation-failed" };
}
