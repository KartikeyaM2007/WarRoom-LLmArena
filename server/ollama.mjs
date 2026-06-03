export const defaultModels = {
  architect: "qwen2.5-coder:1.5b",
  builder: "qwen2.5-coder:1.5b",
  debugger: "deepseek-coder:1.3b",
  refactor: "codegemma:2b",
};

export const agents = {
  architect: { name: "Architect", description: "Plans and designs solutions" },
  builder: { name: "Builder", description: "Implements solutions in code" },
  debugger: { name: "Debugger", description: "Finds and fixes issues" },
  refactor: { name: "Refactor", description: "Reviews and improves code quality" },
};

const ollamaEndpoint = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export function resolveOllamaEndpoint(override) {
  return (override || ollamaEndpoint).replace(/\/$/, "");
}

export function parseModelsParam(raw) {
  if (!raw) return { ...defaultModels };
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultModels, ...parsed };
  } catch {
    return { ...defaultModels };
  }
}

export async function isOllamaReady(endpoint = resolveOllamaEndpoint()) {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function chat(endpoint, model, system, prompt, numPredict) {
  const response = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: numPredict > 200 ? 0.15 : 0.45, num_predict: numPredict },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error(`Model ${model} returned an empty message.`);
  }

  return content.replace(/^["']|["']$/g, "");
}

export async function askOllama(endpoint, model, prompt) {
  return chat(
    endpoint,
    model,
    "You are one agent in a multi-agent coding arena. Reply in one short first-person message. No markdown bullets.",
    prompt,
    90,
  );
}

export async function askOllamaCode(endpoint, model, prompt) {
  return chat(
    endpoint,
    model,
    "You are a senior coding agent. Output ONLY complete, production-ready source code for the file. No markdown. No explanation. No placeholders. Implement full behavior.",
    prompt,
    4096,
  );
}

export function makePrompt(agentId, task, instruction, history = []) {
  const agent = agents[agentId];
  const transcript = history
    .map((message) => `${agents[message.agentId].name}: ${message.content}`)
    .join("\n");

  return `Task: ${task}
Agent: ${agent.name}
Role: ${agent.description}
Instruction: ${instruction}
${transcript ? `Conversation so far:\n${transcript}` : ""}
Return one concise chat message in first person.`;
}

export async function agentSpeak({
  endpoint,
  models,
  agentId,
  task,
  instruction,
  fallback,
  history,
  enabled,
}) {
  if (!enabled) {
    return fallback;
  }

  try {
    return await askOllama(endpoint, models[agentId], makePrompt(agentId, task, instruction, history));
  } catch (error) {
    console.warn(`[ollama] ${agentId}: ${error instanceof Error ? error.message : error}`);
    return fallback;
  }
}
