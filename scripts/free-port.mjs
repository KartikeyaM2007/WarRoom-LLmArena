import { execSync } from "node:child_process";

export function freePort(port) {
  if (process.platform === "win32") {
    try {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of output.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) {
          continue;
        }
        const pid = line.trim().split(/\s+/).at(-1);
        if (pid && pid !== "0") {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`Freed port ${port} (stopped PID ${pid})`);
        } catch {
          // ignore
        }
      }
    } catch {
      // port not in use
    }
    return;
  }

  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: "ignore", shell: true });
  } catch {
    // ignore
  }
}

if (process.argv[1]?.endsWith("free-port.mjs")) {
  for (const arg of process.argv.slice(2)) {
    freePort(Number(arg));
  }
}
