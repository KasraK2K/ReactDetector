#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { Command } from "commander";
import { LogStore } from "../core/logStore.js";
import { assertScriptExists, detectFramework, detectProject, readPackageJson } from "../core/project.js";
import { startTargetProject, type TargetRunner } from "../core/targetRunner.js";
import { waitForTargetUrl } from "../core/urlDiscovery.js";
import { startInspectorServer, type InspectorServer } from "../server/server.js";
import type { FrameworkInfo, ProjectInfo } from "../shared/types.js";
import { parseViewportIds } from "../shared/viewports.js";

type RunOptions = {
  script?: string;
  uiPort?: string;
  noOpen?: boolean;
  viewports?: string;
  pm?: string;
};

type InspectOptions = {
  targetUrl?: string;
  project?: string;
  uiPort?: string;
  noOpen?: boolean;
  viewports?: string;
  pm?: string;
};

const program = new Command();

program
  .name("reactdetector")
  .description("Local React and Next.js UI inspector that generates AI-ready context.")
  .version("0.1.0");

program
  .command("run")
  .argument("<projectPath>", "Path to an existing React, Vite, or Next.js project")
  .option("--script <name>", "package.json script to run", "dev")
  .option("--ui-port <port>", "preferred ReactDetector UI port")
  .option("--no-open", "do not open the browser automatically")
  .option("--viewports <ids>", "comma-separated default viewport IDs")
  .option("--pm <pnpm|npm|yarn|bun>", "package manager override")
  .action(async (projectPath: string, options: RunOptions) => {
    await runCommand(projectPath, options);
  });

program
  .command("inspect")
  .requiredOption("--target-url <url>", "URL of an already running target app")
  .option("--project <path>", "optional project path for richer context")
  .option("--ui-port <port>", "preferred ReactDetector UI port")
  .option("--no-open", "do not open the browser automatically")
  .option("--viewports <ids>", "comma-separated default viewport IDs")
  .option("--pm <pnpm|npm|yarn|bun>", "package manager override for context only")
  .action(async (options: InspectOptions) => {
    await inspectCommand(options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ReactDetector failed: ${message}`);
  process.exitCode = 1;
});

async function runCommand(projectPathInput: string, options: RunOptions): Promise<void> {
  const projectPath = path.resolve(projectPathInput);
  const scriptName = options.script ?? "dev";
  const logs = new LogStore();

  const project = await detectProject(projectPath, options.pm);
  assertScriptExists(project.packageJson, scriptName);
  validateViewportOption(options.viewports);

  const runner = startTargetProject({
    projectPath,
    packageManager: project.packageManager,
    scriptName,
    framework: project.framework,
    logs
  });

  const targetUrl = await waitForTargetUrl(logs, project.framework.id, 30000);
  if (!targetUrl) {
    await runner.stop();
    throw new Error(
      "Could not discover the target dev-server URL from logs or default ports. Run your app manually, then use reactdetector inspect --target-url <url> --project <path>."
    );
  }

  const projectInfo: ProjectInfo = {
    projectPath,
    packageManager: project.packageManager,
    framework: project.framework,
    script: scriptName
  };

  const server = await startInspectorServer({
    targetUrl,
    project: projectInfo,
    logs,
    uiPort: parsePort(options.uiPort),
    defaultIssueViewports: parseViewportIds(options.viewports)
  });

  await announceAndWait(server, runner, options.noOpen);
}

async function inspectCommand(options: InspectOptions): Promise<void> {
  if (!options.targetUrl) {
    throw new Error("--target-url is required.");
  }

  validateUrl(options.targetUrl);
  validateViewportOption(options.viewports);

  const logs = new LogStore();
  logs.add("reactdetector", "info", `Attaching to ${options.targetUrl}`);

  const projectInfo = await getAttachProjectInfo(options.project, options.pm);
  const server = await startInspectorServer({
    targetUrl: options.targetUrl,
    project: projectInfo,
    logs,
    uiPort: parsePort(options.uiPort),
    defaultIssueViewports: parseViewportIds(options.viewports)
  });

  await announceAndWait(server, undefined, options.noOpen);
}

async function getAttachProjectInfo(projectPathInput?: string, packageManagerOverride?: string): Promise<ProjectInfo> {
  if (!projectPathInput) {
    return {
      framework: unknownFramework()
    };
  }

  const projectPath = path.resolve(projectPathInput);
  const packageJson = await readPackageJson(projectPath);
  const framework = detectFramework(packageJson);
  const detected = await detectProject(projectPath, packageManagerOverride);

  return {
    projectPath,
    packageManager: detected.packageManager,
    framework
  };
}

function unknownFramework(): FrameworkInfo {
  return {
    id: "unknown",
    label: "Unknown",
    confidence: "low"
  };
}

async function announceAndWait(
  server: InspectorServer,
  runner: TargetRunner | undefined,
  noOpen: boolean | undefined
): Promise<void> {
  console.log(`ReactDetector UI: ${server.uiUrl}`);
  console.log(`Preview proxy: ${server.proxyUrl}`);

  if (!noOpen) {
    openBrowser(server.uiUrl);
  }

  await waitForShutdown(async () => {
    await server.close();
    if (runner) {
      await runner.stop();
    }
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;

  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return;
  }

  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function waitForShutdown(onShutdown: () => Promise<void>): Promise<void> {
  let shuttingDown = false;

  return new Promise((resolve) => {
    const shutdown = async () => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      await onShutdown();
      resolve();
    };

    process.once("SIGINT", () => {
      void shutdown();
    });
    process.once("SIGTERM", () => {
      void shutdown();
    });
  });
}

function parsePort(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid --ui-port value "${value}".`);
  }

  return parsed;
}

function validateUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("URL must use http or https.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid --target-url "${url}": ${message}`);
  }
}

function validateViewportOption(value?: string): void {
  if (!value) {
    return;
  }

  const parsed = parseViewportIds(value);
  if (parsed.length === 0) {
    throw new Error(`--viewports must include one or more of: mobile, tablet, laptop, desktop.`);
  }
}
