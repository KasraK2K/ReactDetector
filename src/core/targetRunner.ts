import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { FrameworkInfo, PackageManager } from "../shared/types.js";
import { LogStore } from "./logStore.js";
import { getRunCommand } from "./project.js";

export type TargetRunner = {
  commandLabel: string;
  child: ChildProcessWithoutNullStreams;
  logs: LogStore;
  stop: () => Promise<void>;
};

export function startTargetProject(options: {
  projectPath: string;
  packageManager: PackageManager;
  scriptName: string;
  framework: FrameworkInfo;
  logs?: LogStore;
}): TargetRunner {
  const logs = options.logs ?? new LogStore();
  const command = getRunCommand(options.packageManager, options.scriptName);
  const commandLabel = `${command.command} ${command.args.join(" ")}`;

  logs.add("reactdetector", "info", `Starting ${options.framework.label} with ${commandLabel}`);
  const spawnCommand = getPlatformSpawnCommand(command.command, command.args);

  const child = spawn(spawnCommand.command, spawnCommand.args, {
    cwd: options.projectPath,
    env: getTargetProcessEnv(),
    windowsHide: true
  });

  child.stdout.on("data", (chunk: Buffer) => {
    splitLines(chunk).forEach((line) => logs.add("target", "stdout", line));
  });

  child.stderr.on("data", (chunk: Buffer) => {
    splitLines(chunk).forEach((line) => logs.add("target", "stderr", line));
  });

  child.on("error", (error) => {
    logs.add("target", "error", error.message);
  });

  child.on("exit", (code, signal) => {
    const suffix = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    logs.add("target", "info", `Target process exited with ${suffix}`);
  });

  return {
    commandLabel,
    child,
    logs,
    stop: () => stopProcess(child, logs)
  };
}

export function getPlatformSpawnCommand(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(formatCmdArg).join(" ")]
  };
}

export function getTargetProcessEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BROWSER: "none"
  };

  if (process.platform === "win32") {
    setEnvValue(env, "npm_config_script_shell", process.env.ComSpec ?? "cmd.exe");
  }

  return env;
}

function setEnvValue(env: NodeJS.ProcessEnv, key: string, value: string): void {
  for (const existingKey of Object.keys(env)) {
    if (existingKey !== key && existingKey.toLowerCase() === key.toLowerCase()) {
      delete env[existingKey];
    }
  }

  env[key] = value;
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/%/g, "%%").replace(/(["^&|<>()])/g, "^$1")}"`;
}

function formatCmdArg(value: string): string {
  return /^[a-zA-Z0-9_./:=@+\\-]+$/.test(value) ? value : quoteCmdArg(value);
}

function splitLines(chunk: Buffer): string[] {
  return chunk
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

async function stopProcess(child: ChildProcessWithoutNullStreams, logs: LogStore): Promise<void> {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  logs.add("reactdetector", "info", "Stopping target process");

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed && child.exitCode === null) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 1500);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}
