import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort } from "./free-port.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const runnerPort = Number(process.env.WARROOM_RUNNER_PORT ?? 8787);
const devPort = Number(process.env.WARROOM_DEV_PORT ?? 5173);

function run(script) {
  const child = spawn(npmCmd, ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
}

console.log("Starting War Room (runner + UI)...\n");
freePort(runnerPort);
freePort(devPort);

run("runner");
setTimeout(() => run("dev"), 400);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
