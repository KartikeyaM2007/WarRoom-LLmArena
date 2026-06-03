import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bug,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  FolderGit2,
  GitBranch,
  MessageSquare,
  Recycle,
  RotateCcw,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  Users,
  CircleCheck,
  CircleX,
  Loader2,
} from "lucide-react";
import "./styles.css";

type AgentId = "architect" | "builder" | "debugger" | "refactor";

type MessageType =
  | "statement"
  | "proposal"
  | "disagreement"
  | "interruption"
  | "agreement";

type Agent = {
  id: AgentId;
  name: string;
  emoji: string;
  color: string;
  softColor: string;
  description: string;
  outputType: "plan" | "patch" | "bugs" | "review";
  finalAction: string;
  finalOutput: string;
};

type Message = {
  id: string;
  agentId: AgentId;
  content: string;
  type: MessageType;
};

type AgentStatus = "idle" | "thinking" | "working" | "completed";

type AgentOutput = {
  finalAction: string;
  finalOutput: string;
};

type WorkspaceArtifact = {
  title: string;
  files: string[];
  activeFile: string;
  code: string;
  terminal: string[];
  status: "queued" | "writing" | "testing" | "passed";
};

type ModelConfig = Record<AgentId, string>;

type OllamaMessage = {
  agentId: AgentId;
  content: string;
  type: MessageType;
};

const DEFAULT_TASK = "Build a todo list web app with add, complete, and delete";

const fallbackOutputs: Record<AgentId, AgentOutput> = {
  architect: {
    finalAction: "Plan completed",
    finalOutput: "Static app plan for the requested task",
  },
  builder: {
    finalAction: "UI implemented",
    finalOutput: "index.html + styles.css for the task",
  },
  debugger: {
    finalAction: "Logic reviewed",
    finalOutput: "app.js behavior and input handling checked",
  },
  refactor: {
    finalAction: "Bundle finalized",
    finalOutput: "Dependency-free preview-ready static app",
  },
};

const queuedArtifacts: Record<AgentId, WorkspaceArtifact> = {
  architect: {
    title: "Planning workspace",
    files: ["waiting.md"],
    activeFile: "waiting.md",
    code: "Waiting for Architect to map the implementation...",
    terminal: ["workspace queued"],
    status: "queued",
  },
  builder: {
    title: "Implementation workspace",
    files: ["waiting.ts"],
    activeFile: "waiting.ts",
    code: "// Waiting for Builder to write code...",
    terminal: ["workspace queued"],
    status: "queued",
  },
  debugger: {
    title: "Debug workspace",
    files: ["waiting.test.ts"],
    activeFile: "waiting.test.ts",
    code: "// Waiting for Debugger to add tests...",
    terminal: ["workspace queued"],
    status: "queued",
  },
  refactor: {
    title: "Review workspace",
    files: ["waiting.md"],
    activeFile: "waiting.md",
    code: "Waiting for Refactor to review quality...",
    terminal: ["workspace queued"],
    status: "queued",
  },
};

const fallbackArtifacts: Record<AgentId, WorkspaceArtifact> = {
  architect: {
    title: "Planning workspace",
    files: ["PLAN.md", "index.html"],
    activeFile: "PLAN.md",
    code: `# Task plan

1. Interpret the prompt (todo app, landing page, calculator, etc.).
2. Write index.html + styles.css + app.js (no bundler).
3. Optional: clone a GitHub seed if provided.`,
    terminal: ["$ draft PLAN.md", "$ map static entrypoints", "plan ready"],
    status: "passed",
  },
  builder: {
    title: "Implementation workspace",
    files: ["index.html", "styles.css"],
    activeFile: "styles.css",
    code: `.app { max-width: 560px; margin: 0 auto; }
header { padding: 20px; border-radius: 16px; background: #fff; }`,
    terminal: ["$ write index.html", "$ write styles.css"],
    status: "passed",
  },
  debugger: {
    title: "Debug workspace",
    files: ["app.js"],
    activeFile: "app.js",
    code: `// Validate user input; avoid unsafe eval unless required by the task
function safeHandler(value) {
  if (!value?.trim()) return;
}`,
    terminal: ["$ review app.js", "$ smoke-test UI", "checks passed"],
    status: "passed",
  },
  refactor: {
    title: "Review workspace",
    files: ["index.html", "styles.css", "app.js", "review-notes.md"],
    activeFile: "review-notes.md",
    code: `# Review notes

- Match the prompt — not a fixed calculator demo
- Three static files only
- Preview must run without npm install`,
    terminal: ["$ inspect diff", "$ verify preview", "review passed"],
    status: "passed",
  },
};

const defaultModels: ModelConfig = {
  architect: "qwen2.5-coder:7b",
  builder: "qwen2.5-coder:7b",
  debugger: "deepseek-coder:6.7b",
  refactor: "qwen2.5-coder:7b",
};

type DetectedModel = {
  name: string;
  parameterSize: string;
  sizeGb: string;
  family: string;
};

type AgentModelRow = {
  agentId: AgentId;
  configured: string;
  installed: boolean;
  weak: boolean;
  parameterSize?: string;
  sizeGb?: string;
};

type ModelRegistryState = {
  loading: boolean;
  error?: string;
  ollamaOnline: boolean;
  runnerOnline: boolean;
  detected: DetectedModel[];
  agents: AgentModelRow[];
};

type ActiveWork = {
  agentId: AgentId;
  model: string;
  activity: string;
};

const agents: Agent[] = [
  {
    id: "architect",
    name: "Architect",
    emoji: "🧠",
    color: "#3b82f6",
    softColor: "#eaf2ff",
    description: "Plans and designs solutions",
    outputType: "plan",
    finalAction: "Source repo inspected",
    finalOutput: "Static plan driven by your prompt",
  },
  {
    id: "builder",
    name: "Builder",
    emoji: "🛠️",
    color: "#10b981",
    softColor: "#e9fbf4",
    description: "Implements solutions in code",
    outputType: "patch",
    finalAction: "UI implemented",
    finalOutput: "index.html + styles.css for your task",
  },
  {
    id: "debugger",
    name: "Debugger",
    emoji: "🐞",
    color: "#ef4444",
    softColor: "#fff0f0",
    description: "Finds and fixes issues",
    outputType: "bugs",
    finalAction: "Logic reviewed",
    finalOutput: "app.js behavior validated",
  },
  {
    id: "refactor",
    name: "Refactor",
    emoji: "♻️",
    color: "#8b5cf6",
    softColor: "#f3edff",
    description: "Reviews and improves code quality",
    outputType: "review",
    finalAction: "Bundle finalized",
    finalOutput: "Preview-ready static app",
  },
];

const debateMessages: Omit<Message, "id">[] = [
  {
    agentId: "architect",
    content: "I'll map the task to a static bundle: index.html, styles.css, app.js.",
    type: "statement",
  },
  {
    agentId: "builder",
    content: "I'll implement the UI and interactions once the structure is clear.",
    type: "statement",
  },
  {
    agentId: "debugger",
    content: "I'll watch user input and edge cases in app.js.",
    type: "statement",
  },
  {
    agentId: "refactor",
    content: "I'll avoid extra dependencies — static files only.",
    type: "statement",
  },
  {
    agentId: "architect",
    content:
      "Proposal: vanilla static app, no bundler. Optional GitHub seed if provided; otherwise a blank workspace.",
    type: "proposal",
  },
  {
    agentId: "builder",
    content:
      "I disagree with pulling in React for a small prototype. Plain HTML/CSS/JS is enough for the preview.",
    type: "disagreement",
  },
  {
    agentId: "debugger",
    content:
      "Interrupting: validate user input in app.js and fail safely — no unchecked eval unless the task truly needs it.",
    type: "interruption",
  },
  {
    agentId: "refactor",
    content: "Agreed. Three files, one preview URL, behavior must match the prompt.",
    type: "agreement",
  },
  {
    agentId: "architect",
    content: "Revised: build exactly what the prompt asks, ship the preview from the runner.",
    type: "proposal",
  },
  {
    agentId: "builder",
    content: "Implementing the HTML shell and styles for the requested feature now.",
    type: "agreement",
  },
  {
    agentId: "debugger",
    content: "I'll smoke-test interactions before we call it done.",
    type: "statement",
  },
  {
    agentId: "refactor",
    content: "Final check: minimal diff, clear review-notes, preview ready.",
    type: "statement",
  },
];

function App() {
  const [task, setTask] = useState(DEFAULT_TASK);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://127.0.0.1:11434");
  const [models, setModels] = useState<ModelConfig>(defaultModels);
  const [parallelOpening, setParallelOpening] = useState(true);
  const [runtimeNote, setRuntimeNote] = useState(
    "Start with npm start. Runner uses Ollama for live agent chat when available; otherwise scripted or UI-only fallbacks.",
  );
  const [runnerEndpoint, setRunnerEndpoint] = useState("http://127.0.0.1:8787");
  const [sourceRepo, setSourceRepo] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [agentOutputs, setAgentOutputs] = useState<Record<AgentId, AgentOutput>>(fallbackOutputs);
  const [workspaceArtifacts, setWorkspaceArtifacts] = useState<Record<AgentId, WorkspaceArtifact>>(queuedArtifacts);
  const [sharedWorkspace, setSharedWorkspace] = useState<WorkspaceArtifact>({
    title: "Generated app",
    files: ["waiting"],
    activeFile: "waiting",
    code: "Waiting for local runner...",
    terminal: ["runner idle"],
    status: "queued",
  });
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentId, AgentStatus>>({
    architect: "idle",
    builder: "idle",
    debugger: "idle",
    refactor: "idle",
  });
  const timers = useRef<number[]>([]);
  const [modelRegistry, setModelRegistry] = useState<ModelRegistryState>({
    loading: true,
    ollamaOnline: false,
    runnerOnline: false,
    detected: [],
    agents: [],
  });
  const [activeWork, setActiveWork] = useState<ActiveWork | null>(null);

  const refreshModelRegistry = useCallback(async () => {
    setModelRegistry((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const params = new URLSearchParams({
        ollama: ollamaEndpoint,
        models: JSON.stringify(models),
      });
      const response = await fetch(`${runnerEndpoint.replace(/\/$/, "")}/api/models?${params}`);
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        ollamaOnline?: boolean;
        detected?: DetectedModel[];
        agents?: AgentModelRow[];
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? `Registry ${response.status}`);
      }
      setModelRegistry({
        loading: false,
        ollamaOnline: Boolean(data.ollamaOnline),
        runnerOnline: true,
        detected: data.detected ?? [],
        agents: data.agents ?? [],
      });
    } catch (error) {
      setModelRegistry({
        loading: false,
        error: error instanceof Error ? error.message : "Could not reach runner",
        ollamaOnline: false,
        runnerOnline: false,
        detected: [],
        agents: agents.map((agent) => ({
          agentId: agent.id,
          configured: models[agent.id],
          installed: false,
          weak: true,
        })),
      });
    }
  }, [models, ollamaEndpoint, runnerEndpoint]);

  useEffect(() => {
    void refreshModelRegistry();
  }, [refreshModelRegistry]);

  const completedAgents = useMemo(
    () => Object.values(agentStatuses).filter((status) => status === "completed").length,
    [agentStatuses],
  );

  const counts = useMemo(
    () => ({
      proposals: messages.filter((message) => message.type === "proposal").length,
      disagreements: messages.filter((message) => message.type === "disagreement").length,
      agreements: messages.filter((message) => message.type === "agreement").length,
    }),
    [messages],
  );

  const resetArena = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setMessages([]);
    setIsRunning(false);
    setRuntimeNote(
      "Start with npm start. Runner uses Ollama for live agent chat when available; otherwise scripted or UI-only fallbacks.",
    );
    setPreviewUrl("");
    setAgentOutputs(fallbackOutputs);
    setWorkspaceArtifacts(queuedArtifacts);
    setSharedWorkspace({
      title: "Generated app",
      files: ["waiting"],
      activeFile: "waiting",
      code: "Waiting for local runner...",
      terminal: ["runner idle"],
      status: "queued",
    });
    setAgentStatuses({
      architect: "idle",
      builder: "idle",
      debugger: "idle",
      refactor: "idle",
    });
    setActiveWork(null);
  };

  const addMessage = (message: Omit<Message, "id">) => {
    setMessages((current) => [
      ...current,
      {
        ...message,
        id: `message-${Date.now()}-${current.length}`,
      },
    ]);
  };

  const playFallbackArena = () => {
    debateMessages.forEach((message, index) => {
      const timer = window.setTimeout(() => {
        addMessage(message);
      }, 250 + index * 260);
      timers.current.push(timer);
    });

    const completeTimer = window.setTimeout(
      () => {
        setAgentStatuses({
          architect: "completed",
          builder: "completed",
          debugger: "completed",
          refactor: "completed",
        });
        setAgentOutputs(fallbackOutputs);
        setWorkspaceArtifacts(fallbackArtifacts);
        setIsRunning(false);
      },
      250 + debateMessages.length * 260 + 500,
    );
    timers.current.push(completeTimer);
  };

  const runArena = async () => {
    resetArena();
    setIsRunning(true);
    setActiveWork(null);
    setAgentStatuses({
      architect: "thinking",
      builder: "thinking",
      debugger: "thinking",
      refactor: "thinking",
    });
    setWorkspaceArtifacts(markArtifactsWriting());
    setSharedWorkspace({
      title: "Generated app",
      files: ["index.html"],
      activeFile: "index.html",
      code: "Connecting to local runner...",
      terminal: ["$ connect local runner"],
      status: "writing",
    });

    const workingTimer = window.setTimeout(() => {
      setAgentStatuses({
        architect: "working",
        builder: "working",
        debugger: "working",
        refactor: "working",
      });
    }, 800);
    timers.current.push(workingTimer);

    try {
      const llmMode = await runLocalRunner({
        task,
        endpoint: runnerEndpoint,
        sourceRepo,
        ollamaEndpoint,
        models,
        parallelOpening,
        addMessage,
        setSharedWorkspace,
        setWorkspaceArtifacts,
        setPreviewUrl,
        setAgentOutputs,
        setRuntimeNote,
        setActiveWork,
      });

      setRuntimeNote(
        llmMode === "ollama"
          ? "Runner finished. Check terminal line code: ollama = AI-generated, scaffold/generation-failed = not a real build."
          : "Runner finished (scripted chat). Start Ollama for real code generation on any task.",
      );
      setAgentStatuses({
        architect: "completed",
        builder: "completed",
        debugger: "completed",
        refactor: "completed",
      });
      setIsRunning(false);
      return;
    } catch (runnerError) {
      setRuntimeNote(`Local runner unavailable; using Ollama-only arena. ${runnerError instanceof Error ? runnerError.message : ""}`);
    }

    try {
      const liveMessages = await runOllamaArena({
        task,
        endpoint: ollamaEndpoint,
        models,
        parallelOpening,
      });

      setRuntimeNote("Live Ollama run completed.");
      for (const message of liveMessages.messages) {
        addMessage(message);
        await wait(180);
      }

      setAgentOutputs(liveMessages.outputs);
      setWorkspaceArtifacts(makeLiveArtifacts(liveMessages.messages, liveMessages.outputs));
      setAgentStatuses({
        architect: "completed",
        builder: "completed",
        debugger: "completed",
        refactor: "completed",
      });
      setIsRunning(false);
    } catch (error) {
      setRuntimeNote(`Ollama unavailable or model failed. Demo fallback active. ${error instanceof Error ? error.message : ""}`);
      playFallbackArena();
    }
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Agent Arena</h1>
        <p>Multi-agent collaboration system with debate and consensus</p>
        {messages.length > 0 ? (
          <button className="reset-button" type="button" onClick={resetArena} disabled={isRunning}>
            <RotateCcw size={20} />
            Reset Arena
          </button>
        ) : null}
      </header>

      <ArchitectureDiagram />

      <PromptBox task={task} setTask={setTask} isRunning={isRunning} runArena={runArena} />

      <LocalRuntimePanel
        endpoint={ollamaEndpoint}
        setEndpoint={setOllamaEndpoint}
        models={models}
        setModels={setModels}
        parallelOpening={parallelOpening}
        setParallelOpening={setParallelOpening}
        runtimeNote={runtimeNote}
        isRunning={isRunning}
        runnerEndpoint={runnerEndpoint}
        setRunnerEndpoint={setRunnerEndpoint}
        sourceRepo={sourceRepo}
        setSourceRepo={setSourceRepo}
      />

      <ModelStatusPanel
        registry={modelRegistry}
        activeWork={activeWork}
        isRunning={isRunning}
        onRefresh={refreshModelRegistry}
      />

      {messages.length > 0 || isRunning ? (
        <>
          <FlowArrow />
          <StatsPanel
            messages={messages.length}
            proposals={counts.proposals}
            disagreements={counts.disagreements}
            agreements={counts.agreements}
            completedAgents={completedAgents}
            isRunning={isRunning}
          />
          <FlowArrow />
          <SharedIdeWorkspace artifact={sharedWorkspace} previewUrl={previewUrl} />
          <FlowArrow />
          <LiveWorkspace artifacts={workspaceArtifacts} statuses={agentStatuses} />
          <FlowArrow />
          <AgentChat messages={messages} />
          <FlowArrow count={agents.length} />
          <AgentCards statuses={agentStatuses} outputs={agentOutputs} />
        </>
      ) : null}
    </main>
  );
}

async function runOllamaArena({
  task,
  endpoint,
  models,
  parallelOpening,
}: {
  task: string;
  endpoint: string;
  models: ModelConfig;
  parallelOpening: boolean;
}): Promise<{ messages: OllamaMessage[]; outputs: Record<AgentId, AgentOutput> }> {
  const openingPrompts: Record<AgentId, { type: MessageType; prompt: string }> = {
    architect: {
      type: "statement",
      prompt: "State your first architectural move for this coding task in one concise message.",
    },
    builder: {
      type: "statement",
      prompt: "State how you will implement once the plan is clear in one concise message.",
    },
    debugger: {
      type: "statement",
      prompt: "State what bugs/security risks you will attack in one concise message.",
    },
    refactor: {
      type: "statement",
      prompt: "State what quality/over-engineering concerns you will watch in one concise message.",
    },
  };

  const openingIds: AgentId[] = ["architect", "builder", "debugger", "refactor"];
  const opening = parallelOpening
    ? await Promise.all(
        openingIds.map(async (agentId) => ({
          agentId,
          type: openingPrompts[agentId].type,
          content: await askOllama(endpoint, models[agentId], makePrompt(agentId, task, openingPrompts[agentId].prompt)),
        })),
      )
    : await runSequential(openingIds, async (agentId) => ({
        agentId,
        type: openingPrompts[agentId].type,
        content: await askOllama(endpoint, models[agentId], makePrompt(agentId, task, openingPrompts[agentId].prompt)),
      }));

  const messages: OllamaMessage[] = opening;

  const architectProposal = await askOllama(
    endpoint,
    models.architect,
    makePrompt("architect", task, "Propose the technical approach for this task. Be specific about files, structure, and tradeoffs.", messages),
  );
  messages.push({ agentId: "architect", type: "proposal", content: architectProposal });

  const builderReview = await askOllama(
    endpoint,
    models.builder,
    makePrompt("builder", task, "Review Architect's proposal. Disagree if it is over-engineered; otherwise agree and narrow the implementation.", messages),
  );
  messages.push({
    agentId: "builder",
    type: builderReview.toLowerCase().includes("disagree") ? "disagreement" : "agreement",
    content: builderReview,
  });

  const debuggerAttack = await askOllama(
    endpoint,
    models.debugger,
    makePrompt("debugger", task, "Interrupt if there is a serious bug, security flaw, or unsafe shortcut in the plan. Be direct.", messages),
  );
  messages.push({ agentId: "debugger", type: "interruption", content: debuggerAttack });

  const refactorAgreement = await askOllama(
    endpoint,
    models.refactor,
    makePrompt("refactor", task, "Say whether you agree with Debugger and propose the cleaner implementation constraint.", messages),
  );
  messages.push({ agentId: "refactor", type: "agreement", content: refactorAgreement });

  const architectRevision = await askOllama(
    endpoint,
    models.architect,
    makePrompt("architect", task, "Revise the approach after the criticism. Ask Builder to implement the next concrete piece.", messages),
  );
  messages.push({ agentId: "architect", type: "proposal", content: architectRevision });

  const builderAcceptance = await askOllama(
    endpoint,
    models.builder,
    makePrompt("builder", task, "Accept the final approach and say what implementation artifact you will produce.", messages),
  );
  messages.push({ agentId: "builder", type: "agreement", content: builderAcceptance });

  const debuggerTests = await askOllama(
    endpoint,
    models.debugger,
    makePrompt("debugger", task, "Name the tests or edge cases you will add.", messages),
  );
  messages.push({ agentId: "debugger", type: "statement", content: debuggerTests });

  const refactorFinal = await askOllama(
    endpoint,
    models.refactor,
    makePrompt("refactor", task, "Give the final code-quality constraint in one concise message.", messages),
  );
  messages.push({ agentId: "refactor", type: "statement", content: refactorFinal });

  return {
    messages,
    outputs: {
      architect: {
        finalAction: "Plan completed",
        finalOutput: summarizeOutput(messages, "architect", "Static app structure and file layout"),
      },
      builder: {
        finalAction: "Implementation plan prepared",
        finalOutput: summarizeOutput(messages, "builder", "UI and logic implementation steps"),
      },
      debugger: {
        finalAction: "Risk review completed",
        finalOutput: summarizeOutput(messages, "debugger", "Input validation and edge-case checks"),
      },
      refactor: {
        finalAction: "Code review completed",
        finalOutput: summarizeOutput(messages, "refactor", "Minimal static bundle, no over-engineering"),
      },
    },
  };
}

function runLocalRunner({
  task,
  endpoint,
  sourceRepo,
  ollamaEndpoint,
  models,
  parallelOpening,
  addMessage,
  setSharedWorkspace,
  setWorkspaceArtifacts,
  setPreviewUrl,
  setAgentOutputs,
  setRuntimeNote,
  setActiveWork,
}: {
  task: string;
  endpoint: string;
  sourceRepo: string;
  ollamaEndpoint: string;
  models: ModelConfig;
  parallelOpening: boolean;
  addMessage: (message: Omit<Message, "id">) => void;
  setSharedWorkspace: (artifact: WorkspaceArtifact) => void;
  setWorkspaceArtifacts: React.Dispatch<React.SetStateAction<Record<AgentId, WorkspaceArtifact>>>;
  setPreviewUrl: (url: string) => void;
  setAgentOutputs: (outputs: Record<AgentId, AgentOutput>) => void;
  setRuntimeNote: (note: string) => void;
  setActiveWork: (work: ActiveWork | null) => void;
}): Promise<"ollama" | "scripted"> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      task,
      source: sourceRepo,
      ollama: ollamaEndpoint,
      models: JSON.stringify(models),
      parallel: parallelOpening ? "1" : "0",
    });
    const source = new EventSource(`${endpoint.replace(/\/$/, "")}/api/run?${params}`);
    let llmMode: "ollama" | "scripted" = "scripted";
    let settled = false;
    const failTimer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      source.close();
      reject(new Error("runner not reachable — stop other processes on :8787, then npm start"));
    }, 12000);

    source.addEventListener("open", () => {
      window.clearTimeout(failTimer);
    });

    source.addEventListener("meta", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        llmMode?: "ollama" | "scripted";
        buildMode?: "custom" | "calculator";
        task?: string;
        previewUrl?: string;
      };
      if (data.llmMode) {
        llmMode = data.llmMode;
      }
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      const modeLabel = data.buildMode === "calculator" ? "calculator" : "custom task";
      setRuntimeNote(
        data.llmMode === "ollama"
          ? `Runner building (${modeLabel}) with live Ollama chat and generated files...`
          : `Runner building (${modeLabel}) with scripted chat (start Ollama for live dialogue + code gen)...`,
      );
    });

    source.addEventListener("status", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { message: string; previewUrl?: string };
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      setSharedWorkspace({
        title: "Generated app",
        files: ["index.html"],
        activeFile: "index.html",
        code: data.message,
        terminal: [`$ ${data.message}`],
        status: "writing",
      });
    });

    source.addEventListener("agent-active", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as ActiveWork;
      setActiveWork(data);
    });

    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as Omit<Message, "id">;
      addMessage(data);
    });

    source.addEventListener("workspace", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as Omit<WorkspaceArtifact, "title">;
      setSharedWorkspace({
        title: "Generated app",
        ...data,
      });
    });

    source.addEventListener("agent-workspace", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as WorkspaceArtifact & { agentId: AgentId };
      setWorkspaceArtifacts((current) => ({
        ...current,
        [data.agentId]: {
          title: data.title,
          files: data.files,
          activeFile: data.activeFile,
          code: data.code,
          terminal: data.terminal,
          status: data.status,
        },
      }));
    });

    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        previewUrl: string;
        outputs: Record<AgentId, AgentOutput>;
        llmMode?: "ollama" | "scripted";
        codeSource?: string;
      };
      settled = true;
      window.clearTimeout(failTimer);
      if (data.llmMode) {
        llmMode = data.llmMode;
      }
      setPreviewUrl(data.previewUrl);
      setAgentOutputs(data.outputs);
      setActiveWork(null);
      if (data.codeSource) {
        const real = data.codeSource === "ollama" || data.codeSource === "ollama-single-file";
        setRuntimeNote(
          real
            ? `Build complete — code written by Ollama (${data.codeSource}). Preview is your generated app.`
            : `Build finished but code is NOT from Ollama (${data.codeSource}). Use a larger model or retry.`,
        );
      }
      source.close();
      resolve(llmMode);
    });

    source.addEventListener("run-error", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { message: string };
      settled = true;
      window.clearTimeout(failTimer);
      setActiveWork(null);
      source.close();
      reject(new Error(data.message));
    });

    source.onerror = () => {
      if (settled) {
        return;
      }
      window.clearTimeout(failTimer);
      setActiveWork(null);
      source.close();
      reject(
        new Error(
          "runner connection lost — port 8787 may be stuck. Close extra terminals, run npm start again, then retry.",
        ),
      );
    };
  });
}

async function askOllama(endpoint: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: {
        temperature: 0.45,
        num_predict: 90,
      },
      messages: [
        {
          role: "system",
          content:
            "You are one agent inside a visible multi-agent coding arena. Reply in one short message only. Do not use markdown bullets.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error(`Model ${model} returned an empty message.`);
  }

  return content.replace(/^["']|["']$/g, "");
}

function makePrompt(agentId: AgentId, task: string, instruction: string, history: OllamaMessage[] = []) {
  const agent = agents.find((item) => item.id === agentId)!;
  const transcript = history
    .map((message) => {
      const speaker = agents.find((item) => item.id === message.agentId)!.name;
      return `${speaker}: ${message.content}`;
    })
    .join("\n");

  return `Task: ${task}
Agent: ${agent.name}
Role: ${agent.description}
Instruction: ${instruction}
${transcript ? `Conversation so far:\n${transcript}` : ""}
Return one concise chat message in first person.`;
}

async function runSequential<T>(items: AgentId[], fn: (item: AgentId) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}

function summarizeOutput(messages: OllamaMessage[], agentId: AgentId, fallback: string) {
  const latest = [...messages].reverse().find((message) => message.agentId === agentId)?.content ?? fallback;
  return latest.length > 88 ? `${latest.slice(0, 85)}...` : latest;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function markArtifactsWriting(): Record<AgentId, WorkspaceArtifact> {
  return {
    architect: {
      ...queuedArtifacts.architect,
      code: "Architect is drafting the plan for your task...",
      terminal: ["$ create run directory", "$ git clone seed", "writing plan..."],
      status: "writing",
    },
    builder: {
      ...queuedArtifacts.builder,
      code: "// Builder is waiting for plan, then writing index.html and styles.css...",
      terminal: ["$ prepare static shell", "$ layout keypad", "writing UI..."],
      status: "writing",
    },
    debugger: {
      ...queuedArtifacts.debugger,
      code: "// Debugger is hardening expression evaluation in app.js...",
      terminal: ["$ inspect eval path", "$ add sanitizer", "writing guards..."],
      status: "testing",
    },
    refactor: {
      ...queuedArtifacts.refactor,
      code: "Refactor is checking for extra dependencies and duplicate input handlers...",
      terminal: ["$ inspect diff", "$ verify three-file bundle", "reviewing quality..."],
      status: "writing",
    },
  };
}

function makeLiveArtifacts(
  messages: OllamaMessage[],
  outputs: Record<AgentId, AgentOutput>,
): Record<AgentId, WorkspaceArtifact> {
  return {
    architect: {
      ...fallbackArtifacts.architect,
      code: `# Live Architect Plan\n\n${outputs.architect.finalOutput}\n\n${messages
        .filter((message) => message.agentId === "architect")
        .map((message) => `- ${message.content}`)
        .join("\n")}`,
      terminal: ["$ scan seed repo", "$ draft static plan", "plan passed"],
    },
    builder: {
      ...fallbackArtifacts.builder,
      code: `/* Builder note: ${outputs.builder.finalOutput} */\n\n${fallbackArtifacts.builder.code}`,
      terminal: ["$ write index.html", "$ write styles.css", "UI passed"],
    },
    debugger: {
      ...fallbackArtifacts.debugger,
      code: `/* Debugger note: ${outputs.debugger.finalOutput} */\n\n${fallbackArtifacts.debugger.code}`,
      terminal: ["$ harden app.js", "$ verify invalid input", "safety passed"],
    },
    refactor: {
      ...fallbackArtifacts.refactor,
      code: `# Live Refactor Review\n\n${outputs.refactor.finalOutput}\n\n- static files only\n- sanitized evaluator\n- shared button/keyboard path`,
      terminal: ["$ review bundle", "$ approve diff", "review passed"],
    },
  };
}

function ArchitectureDiagram() {
  return (
    <section className="architecture-card">
      <h2>System Architecture</h2>
      <div className="architecture-row">
        <div className="arch-box prompt-arch">
          <MessageSquare size={36} strokeWidth={1.8} />
          <strong>Prompt Box</strong>
        </div>
        <span className="right-arrow">→</span>
        <div className="arch-box group-arch">
          <Users size={34} strokeWidth={1.9} />
          <strong>Group Chat</strong>
          <small>Debate & Consensus</small>
        </div>
        <span className="right-arrow">→</span>
        <div className="mini-agent-row">
          <MiniArchitectureBox label="Plan" icon={GitBranch} color="#3b82f6" bg="#ecf3ff" />
          <MiniArchitectureBox label="Code" icon={Code2} color="#10b981" bg="#eafaf2" />
          <MiniArchitectureBox label="Debug" icon={Bug} color="#ef4444" bg="#fff0f0" />
          <MiniArchitectureBox label="Review" icon={Recycle} color="#8b5cf6" bg="#f4edff" />
        </div>
      </div>
      <p>Agents collaborate in real-time, debate solutions, and produce specialized outputs</p>
    </section>
  );
}

function MiniArchitectureBox({
  label,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  color: string;
  bg: string;
}) {
  return (
    <div className="mini-arch-box" style={{ "--accent": color, "--soft": bg } as React.CSSProperties}>
      <Icon size={24} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}

function PromptBox({
  task,
  setTask,
  isRunning,
  runArena,
}: {
  task: string;
  setTask: (task: string) => void;
  isRunning: boolean;
  runArena: () => void;
}) {
  return (
    <section className="prompt-card">
      <label htmlFor="arena-prompt">Prompt Box</label>
      <textarea
        id="arena-prompt"
        value={task}
        onChange={(event) => setTask(event.target.value)}
        disabled={isRunning}
      />
      <button className="run-button" type="button" onClick={runArena} disabled={isRunning || !task.trim()}>
        <Sparkles size={24} />
        {isRunning ? "Arena Running..." : "Run Agent Arena"}
      </button>
    </section>
  );
}

function ModelStatusPanel({
  registry,
  activeWork,
  isRunning,
  onRefresh,
}: {
  registry: ModelRegistryState;
  activeWork: ActiveWork | null;
  isRunning: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="model-status-card">
      <div className="model-status-head">
        <div>
          <strong>Model registry</strong>
          <p>
            {registry.loading
              ? "Scanning Ollama..."
              : registry.runnerOnline
                ? registry.ollamaOnline
                  ? `${registry.detected.length} model(s) detected on Ollama`
                  : "Runner OK — Ollama offline"
                : "Runner offline — start npm start"}
          </p>
        </div>
        <button className="refresh-models-btn" type="button" onClick={onRefresh} disabled={registry.loading || isRunning}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {registry.error ? <p className="model-status-error">{registry.error}</p> : null}

      {activeWork ? (
        <div className="model-active-banner">
          <Loader2 size={16} className="spin" />
          <span>
            <strong>{agents.find((a) => a.id === activeWork.agentId)?.name}</strong> working —{" "}
            <code>{activeWork.model}</code> — {activeWork.activity}
          </span>
        </div>
      ) : null}

      <div className="model-agent-table">
        {registry.agents.map((row) => {
          const agent = agents.find((item) => item.id === row.agentId)!;
          const isActive = activeWork?.agentId === row.agentId;
          return (
            <article
              key={row.agentId}
              className={`model-agent-row${isActive ? " active" : ""}`}
              style={{ "--agent-color": agent.color } as React.CSSProperties}
            >
              <div className="model-agent-title">
                <span>{agent.emoji}</span>
                <strong>{agent.name}</strong>
                {isActive ? <span className="working-pill">working</span> : null}
              </div>
              <code className="model-name">{row.configured}</code>
              <div className="model-flags">
                {row.installed ? (
                  <span className="flag ok">
                    <CircleCheck size={14} /> Installed
                  </span>
                ) : (
                  <span className="flag bad">
                    <CircleX size={14} /> Missing — run ollama pull {row.configured}
                  </span>
                )}
                {row.weak ? <span className="flag warn">Small model — use 7B+ for code</span> : null}
                {row.parameterSize ? <span className="flag meta">{row.parameterSize}</span> : null}
                {row.sizeGb ? <span className="flag meta">{row.sizeGb}</span> : null}
              </div>
            </article>
          );
        })}
      </div>

      {registry.detected.length > 0 ? (
        <details className="detected-models">
          <summary>All detected models ({registry.detected.length})</summary>
          <ul>
            {registry.detected.map((model) => (
              <li key={model.name}>
                <code>{model.name}</code>
                {model.parameterSize ? <span>{model.parameterSize}</span> : null}
                {model.sizeGb ? <span>{model.sizeGb}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function LocalRuntimePanel({
  endpoint,
  setEndpoint,
  models,
  setModels,
  parallelOpening,
  setParallelOpening,
  runtimeNote,
  isRunning,
  runnerEndpoint,
  setRunnerEndpoint,
  sourceRepo,
  setSourceRepo,
}: {
  endpoint: string;
  setEndpoint: (endpoint: string) => void;
  models: ModelConfig;
  setModels: (models: ModelConfig) => void;
  parallelOpening: boolean;
  setParallelOpening: (enabled: boolean) => void;
  runtimeNote: string;
  isRunning: boolean;
  runnerEndpoint: string;
  setRunnerEndpoint: (endpoint: string) => void;
  sourceRepo: string;
  setSourceRepo: (sourceRepo: string) => void;
}) {
  const updateModel = (agentId: AgentId, model: string) => {
    setModels({
      ...models,
      [agentId]: model,
    });
  };

  return (
    <section className="runtime-card">
      <div className="runtime-heading">
        <div>
          <strong>Local LLM Runtime</strong>
          <p>{runtimeNote}</p>
          <p className="runtime-hint">
            Custom tasks need Ollama + a capable Builder model. Terminal shows code: ollama | ollama-single-file | scaffold |
            generation-failed.
          </p>
        </div>
        <label className="parallel-toggle">
          <input
            type="checkbox"
            checked={parallelOpening}
            disabled={isRunning}
            onChange={(event) => setParallelOpening(event.target.checked)}
          />
          Parallel opening round
        </label>
      </div>
      <label className="endpoint-field">
        Ollama endpoint
        <input value={endpoint} disabled={isRunning} onChange={(event) => setEndpoint(event.target.value)} />
      </label>
      <label className="endpoint-field">
        Local runner endpoint
        <input value={runnerEndpoint} disabled={isRunning} onChange={(event) => setRunnerEndpoint(event.target.value)} />
      </label>
        <label className="endpoint-field">
        GitHub source repo (optional)
        <input
          value={sourceRepo}
          placeholder="https://github.com/org/repo.git — leave empty for blank workspace"
          disabled={isRunning}
          onChange={(event) => setSourceRepo(event.target.value)}
        />
      </label>
      <div className="model-grid">
        {agents.map((agent) => (
          <label key={agent.id}>
            {agent.name}
            <input
              value={models[agent.id]}
              disabled={isRunning}
              onChange={(event) => updateModel(agent.id, event.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function FlowArrow({ count = 1 }: { count?: number }) {
  return (
    <div className={count > 1 ? "flow-arrow multi" : "flow-arrow"} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index}>↓</span>
      ))}
    </div>
  );
}

function StatsPanel({
  messages,
  proposals,
  disagreements,
  agreements,
  completedAgents,
  isRunning,
}: {
  messages: number;
  proposals: number;
  disagreements: number;
  agreements: number;
  completedAgents: number;
  isRunning: boolean;
}) {
  return (
    <section className="stats-grid">
      <StatCard icon={MessageSquare} label="Messages" value={`${messages}`} detail={`${proposals}p / ${disagreements}d / ${agreements}a`} />
      <StatCard icon={Users} label="Agents" value="4" detail="Active participants" />
      <StatCard icon={CheckCircle2} label="Completed" value={`${completedAgents}/4`} detail="Agents finished" />
      <StatCard
        icon={Clock}
        label="Status"
        value={isRunning ? "Running" : completedAgents === 4 ? "Complete" : "Idle"}
        detail="Ready"
        success={!isRunning && completedAgents === 4}
      />
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  success = false,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  detail: string;
  success?: boolean;
}) {
  return (
    <article className="stat-card">
      <div>
        <Icon size={21} strokeWidth={1.8} />
        <span>{label}</span>
      </div>
      <strong className={success ? "success-text" : ""}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function AgentChat({ messages }: { messages: Message[] }) {
  return (
    <section className="chat-card">
      <header>Agent Group Chat</header>
      <div className="chat-scroll">
        {messages.map((message) => {
          const agent = agents.find((item) => item.id === message.agentId)!;
          return (
            <article className="chat-message" key={message.id}>
              <div className="avatar" style={{ backgroundColor: agent.softColor }}>
                {agent.emoji}
              </div>
              <div>
                <div className="message-heading">
                  <strong style={{ color: agent.color }}>{agent.name}</strong>
                  {message.type !== "statement" ? (
                    <span className={`message-type ${message.type}`}>{message.type}</span>
                  ) : null}
                </div>
                <p>{message.content}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LiveWorkspace({
  artifacts,
  statuses,
}: {
  artifacts: Record<AgentId, WorkspaceArtifact>;
  statuses: Record<AgentId, AgentStatus>;
}) {
  return (
    <section className="workspace-card">
      <header>
        <div>
          <h2>Live Build Workspace</h2>
          <p>Each agent owns a slice of the run directory, writes files, runs checks, then hands off to the next role.</p>
        </div>
        <span className="preview-pill">Preview target: local app window</span>
      </header>
      <div className="workspace-grid">
        {agents.map((agent) => (
          <AgentWorkspace
            key={agent.id}
            agent={agent}
            status={statuses[agent.id]}
            artifact={artifacts[agent.id]}
          />
        ))}
      </div>
    </section>
  );
}

function SharedIdeWorkspace({
  artifact,
  previewUrl,
}: {
  artifact: WorkspaceArtifact;
  previewUrl: string;
}) {
  return (
    <section className="workspace-card shared-ide-card">
      <header>
        <div>
          <h2>Shared IDE and Live App</h2>
          <p>
            The runner asks Ollama to write real files for your prompt (not a hidden template). Check the terminal
            line: <code>code: ollama</code> means AI-generated.
          </p>
        </div>
        {previewUrl ? (
          <a className="preview-pill preview-link" href={previewUrl} target="_blank" rel="noreferrer">
            Open live preview
          </a>
        ) : (
          <span className="preview-pill">Waiting for preview</span>
        )}
      </header>
      <div className="shared-ide-layout">
        <AgentWorkspace
          agent={agents[1]}
          status={artifact.status === "passed" ? "completed" : "working"}
          artifact={artifact}
        />
        <div className="app-preview-frame">
          {previewUrl ? (
            <iframe title="Generated app preview" src={previewUrl} />
          ) : (
            <div className="preview-empty">The generated app preview will appear here.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function AgentWorkspace({
  agent,
  artifact,
  status,
}: {
  agent: Agent;
  artifact: WorkspaceArtifact;
  status: AgentStatus;
}) {
  return (
    <article className="agent-workspace" style={{ "--agent-color": agent.color } as React.CSSProperties}>
      <div className="workspace-head">
        <div>
          <span>{agent.emoji}</span>
          <strong>{agent.name}</strong>
        </div>
        <small>{status}</small>
      </div>
      <div className="workspace-body">
        <aside className="file-tree">
          <div>
            <FolderGit2 size={15} />
            <strong>{artifact.title}</strong>
          </div>
          {artifact.files.map((file) => (
            <span className={file === artifact.activeFile ? "active-file" : ""} key={file}>
              {file}
            </span>
          ))}
        </aside>
        <div className="code-pane">
          <div className="code-title">
            <Code2 size={15} />
            {artifact.activeFile}
          </div>
          <pre>{artifact.code}</pre>
        </div>
        <div className="terminal-pane">
          <div className="code-title">
            <TerminalSquare size={15} />
            terminal
          </div>
          {artifact.terminal.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
      <div className={`workspace-status ${artifact.status}`}>
        {artifact.status === "passed" ? "checks passed" : artifact.status}
      </div>
    </article>
  );
}

function AgentCards({
  statuses,
  outputs,
}: {
  statuses: Record<AgentId, AgentStatus>;
  outputs: Record<AgentId, AgentOutput>;
}) {
  return (
    <section className="agent-output-grid">
      {agents.map((agent) => {
        const status = statuses[agent.id];
        return (
          <article className="output-card" key={agent.id} style={{ "--agent-color": agent.color } as React.CSSProperties}>
            <div className="output-head">
              <div>
                <span>{agent.emoji}</span>
                <strong>{agent.name}</strong>
              </div>
              {status === "completed" ? <CheckCircle2 size={19} /> : null}
              <p>{agent.description}</p>
            </div>
            <div className="output-body">
              <small>Status</small>
              <div className="status-line">
                <span className={status === "completed" ? "green-dot" : "gray-dot"} />
                <strong>{status === "completed" ? "Completed" : status}</strong>
              </div>
              <small>Current Action</small>
              <p>{status === "completed" ? outputs[agent.id].finalAction : "Waiting for task..."}</p>
              {status === "completed" ? (
                <div className="output-result">
                  <div>
                    <FileText size={19} />
                    <strong>{agent.outputType}</strong>
                  </div>
                  <p>{outputs[agent.id].finalOutput}</p>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
