export function resolveBuildPlan(task, sourceRepo = "") {
  const normalizedTask = (task || "").trim() || "Build a small static web prototype";
  const repo = (sourceRepo || "").trim().toLowerCase();
  const taskLower = normalizedTask.toLowerCase();

  const isCalculator =
    /\bcalculator\b|\bcalc\b|scientific.?calc/i.test(taskLower) || repo.includes("calculator");

  return {
    task: normalizedTask,
    mode: isCalculator ? "calculator" : "custom",
    workspaceDir: "workspace",
    hasSourceRepo: Boolean((sourceRepo || "").trim()),
    sourceRepo: (sourceRepo || "").trim(),
  };
}

export function planMarkdown(plan) {
  const seed = plan.hasSourceRepo
    ? `1. Clone ${plan.sourceRepo} into the run workspace\n2. `
    : "1. Start from an empty workspace\n2. ";

  if (plan.mode === "calculator") {
    return `# Plan\n\nTask: ${plan.task}\n\n${seed}Ship index.html + styles.css + app.js (scientific calculator UI, safe eval).\n`;
  }

  return `# Plan\n\nTask: ${plan.task}\n\n${seed}Ship a dependency-free static prototype: index.html, styles.css, app.js.\n`;
}
