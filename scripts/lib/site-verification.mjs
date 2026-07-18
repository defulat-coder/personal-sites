import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export const repositoryRoot = process.cwd();
export const evidenceDirectory = path.join(
  repositoryRoot,
  "var/verification/personal-site/latest",
);

export function createRunId() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export async function writeJsonAtomic(fileName, value) {
  await mkdir(evidenceDirectory, { recursive: true });
  const destination = path.join(evidenceDirectory, fileName);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
  return destination;
}

export async function writeTextAtomic(fileName, value) {
  await mkdir(evidenceDirectory, { recursive: true });
  const destination = path.join(evidenceDirectory, fileName);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, value, "utf8");
  await rename(temporary, destination);
  return destination;
}

export function runCommand(command, arguments_, options = {}) {
  const { env = {}, inherit = true } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: { ...process.env, ...env },
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    if (!inherit) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ code, stderr, stdout });
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit ${code}`;
      const error = new Error(`${command} ${arguments_.join(" ")} failed (${reason})`);
      error.code = code;
      error.stderr = stderr;
      error.stdout = stdout;
      reject(error);
    });
  });
}

async function assertPortAvailable(host, port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", (error) => {
      reject(
        new Error(
          `Cannot start verification server at ${host}:${port}: ${error.message}`,
        ),
      );
    });
    probe.listen({ host, port }, () => {
      probe.close(resolve);
    });
  });
}

async function waitForUrl(url, child, timeoutMs = 45_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Verification server exited early with ${child.exitCode}`);
    }

    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }

  const exited = new Promise((resolve) => child.once("exit", resolve));

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    child.kill("SIGTERM");
  }

  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!stopped && child.exitCode === null) {
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      child.kill("SIGKILL");
    }
    await exited;
  }
}

export async function withProductionServer(callback, options = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3000;
  const localUrl = `http://${host}:${port}/`;

  await assertPortAvailable(host, port);
  await runCommand("pnpm", ["build"]);

  const child = spawn(
    path.join(repositoryRoot, "node_modules/.bin/next"),
    ["start", "--hostname", host, "--port", String(port)],
    {
      cwd: repositoryRoot,
      detached: process.platform !== "win32",
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const serverOutput = [];
  child.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  child.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

  try {
    await waitForUrl(localUrl, child);
    return await callback({ localUrl, serverOutput });
  } finally {
    await stopServer(child);
  }
}
