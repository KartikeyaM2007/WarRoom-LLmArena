import { isOllamaReady, resolveOllamaEndpoint } from "./ollama.mjs";

const agentOrder = ["architect", "builder", "debugger", "refactor"];

export function isWeakModel(name, parameterSize = "") {
  const label = `${name} ${parameterSize}`.toLowerCase();
  return /:1\.|1\.5b|1\.3b|1\.8b|:2b|:3b|2b-|3b-/.test(label);
}

function formatSize(bytes) {
  if (!bytes) {
    return "";
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export async function listOllamaModels(endpoint) {
  const response = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Ollama tags ${response.status}`);
  }
  const data = await response.json();
  return (data.models ?? []).map((entry) => ({
    name: entry.name,
    parameterSize: entry.details?.parameter_size ?? "",
    sizeGb: formatSize(entry.size),
    family: entry.details?.family ?? "",
  }));
}

function modelInstalled(configured, detectedNames) {
  if (detectedNames.has(configured)) {
    return true;
  }
  return [...detectedNames].some(
    (name) => name === configured || name.startsWith(`${configured}:`) || configured.startsWith(`${name}:`),
  );
}

export async function inspectModelRegistry(ollamaEndpoint, models) {
  const endpoint = resolveOllamaEndpoint(ollamaEndpoint);
  const online = await isOllamaReady(endpoint);

  if (!online) {
    return {
      ollamaOnline: false,
      ollamaEndpoint: endpoint,
      detected: [],
      agents: agentOrder.map((agentId) => ({
        agentId,
        configured: models[agentId],
        installed: false,
        weak: isWeakModel(models[agentId]),
        active: false,
      })),
    };
  }

  const detected = await listOllamaModels(endpoint);
  const detectedNames = new Set(detected.map((entry) => entry.name));

  const agents = agentOrder.map((agentId) => {
    const configured = models[agentId];
    const match = detected.find((entry) => entry.name === configured || entry.name.startsWith(`${configured}`));
    return {
      agentId,
      configured,
      installed: modelInstalled(configured, detectedNames),
      weak: isWeakModel(configured, match?.parameterSize ?? ""),
      parameterSize: match?.parameterSize ?? "",
      sizeGb: match?.sizeGb ?? "",
      active: false,
    };
  });

  return {
    ollamaOnline: true,
    ollamaEndpoint: endpoint,
    detected,
    agents,
  };
}
