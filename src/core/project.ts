import fs from "node:fs";
import path from "node:path";
import type { FrameworkInfo, PackageManager } from "../shared/types.js";

export type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  packageManager?: string;
};

export type ProjectDetection = {
  projectPath: string;
  packageJson: PackageJson;
  framework: FrameworkInfo;
  packageManager: PackageManager;
};

const packageManagers: PackageManager[] = ["pnpm", "npm", "yarn", "bun"];

export function isPackageManager(value: string): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

export async function readPackageJson(projectPath: string): Promise<PackageJson> {
  const filePath = path.join(projectPath, "package.json");
  const raw = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

export async function detectProject(projectPathInput: string, packageManagerOverride?: string): Promise<ProjectDetection> {
  const projectPath = path.resolve(projectPathInput);
  const packageJson = await readPackageJson(projectPath);
  const framework = detectFramework(packageJson);
  const packageManager = await detectPackageManager(projectPath, packageJson, packageManagerOverride);

  return {
    projectPath,
    packageJson,
    framework,
    packageManager
  };
}

export function detectFramework(packageJson: PackageJson): FrameworkInfo {
  const deps = {
    ...packageJson.peerDependencies,
    ...packageJson.devDependencies,
    ...packageJson.dependencies
  };

  if (deps.next) {
    return { id: "next", label: "Next.js", confidence: "high" };
  }

  if (deps.vite && deps.react) {
    return { id: "vite-react", label: "Vite React", confidence: "high" };
  }

  if (deps["react-scripts"]) {
    return { id: "cra", label: "Create React App", confidence: "medium" };
  }

  if (deps.react) {
    return { id: "react-unknown", label: "React", confidence: "low" };
  }

  return { id: "unknown", label: "Unknown", confidence: "low" };
}

export async function detectPackageManager(
  projectPath: string,
  packageJson: PackageJson,
  override?: string
): Promise<PackageManager> {
  if (override) {
    if (!isPackageManager(override)) {
      throw new Error(`Unsupported package manager "${override}". Use pnpm, npm, yarn, or bun.`);
    }
    return override;
  }

  const declared = packageJson.packageManager?.split("@")[0];
  if (declared && isPackageManager(declared)) {
    return declared;
  }

  const lockFiles: Array<[string, PackageManager]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"]
  ];

  for (const [fileName, packageManager] of lockFiles) {
    if (await fileExists(path.join(projectPath, fileName))) {
      return packageManager;
    }
  }

  return "pnpm";
}

export function getRunCommand(packageManager: PackageManager, scriptName: string): { command: string; args: string[] } {
  switch (packageManager) {
    case "npm":
      return { command: "npm", args: ["run", scriptName] };
    case "pnpm":
      return { command: "pnpm", args: ["run", scriptName] };
    case "yarn":
      return { command: "yarn", args: [scriptName] };
    case "bun":
      return { command: "bun", args: ["run", scriptName] };
  }
}

export function assertScriptExists(packageJson: PackageJson, scriptName: string): void {
  if (!packageJson.scripts?.[scriptName]) {
    const scripts = Object.keys(packageJson.scripts ?? {});
    const suffix = scripts.length > 0 ? ` Available scripts: ${scripts.join(", ")}.` : " No scripts are defined.";
    throw new Error(`Script "${scriptName}" was not found in package.json.${suffix}`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

