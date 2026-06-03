/** Scripted arguing sequence when Ollama is off (matches docs/demo/DEBATE.md). */
export function scriptedDebateMessages(plan) {
  const task = plan.task;
  const seed = plan.hasSourceRepo ? ` using ${plan.sourceRepo} as a seed` : "";
  return [
    {
      agentId: "architect",
      type: "proposal",
      content: `Proposal: static bundle (index.html, styles.css, app.js)${seed} for — ${task}`,
    },
    {
      agentId: "builder",
      type: "disagreement",
      content:
        "Disagree on scope: no React or build step for this size. Vanilla DOM + localStorage is enough for add/complete/delete.",
    },
    {
      agentId: "debugger",
      type: "interruption",
      content:
        "Interrupt: validate task text before add; no eval of user input; guard empty strings and duplicate ids in the list.",
    },
    {
      agentId: "refactor",
      type: "agreement",
      content: "Agree: three files, one preview URL, minimal CSS — ship the smallest working todo UX.",
    },
    {
      agentId: "architect",
      type: "proposal",
      content: "Revised plan: PLAN.md first, then HTML shell, styles, app.js with localStorage persistence.",
    },
    {
      agentId: "builder",
      type: "agreement",
      content: "Agree — I'll implement the revised static bundle now.",
    },
    {
      agentId: "debugger",
      type: "statement",
      content: "I'll smoke-check add/complete/delete and empty-input edge cases after write.",
    },
    {
      agentId: "refactor",
      type: "statement",
      content: "I'll keep selectors flat and avoid extra dependencies in review-notes.",
    },
  ];
}
