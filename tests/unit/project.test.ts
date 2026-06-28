import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectFramework, detectPackageManager, getRunCommand, type PackageJson } from "../../src/core/project.js";

describe("project detection", () => {
  it("detects Next.js projects", () => {
    const packageJson: PackageJson = {
      dependencies: {
        next: "15.0.0",
        react: "18.3.1"
      }
    };

    expect(detectFramework(packageJson)).toMatchObject({
      id: "next",
      label: "Next.js",
      confidence: "high"
    });
  });

  it("detects Vite React projects", () => {
    const packageJson: PackageJson = {
      dependencies: {
        react: "18.3.1"
      },
      devDependencies: {
        vite: "6.0.0"
      }
    };

    expect(detectFramework(packageJson)).toMatchObject({
      id: "vite-react",
      confidence: "high"
    });
  });

  it("chooses package managers from lockfiles", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "reactdetector-"));
    await fs.writeFile(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");

    await expect(detectPackageManager(dir, {})).resolves.toBe("pnpm");
  });

  it("honors package manager override", async () => {
    await expect(detectPackageManager(os.tmpdir(), {}, "bun")).resolves.toBe("bun");
    await expect(detectPackageManager(os.tmpdir(), {}, "bad")).rejects.toThrow(/Unsupported package manager/);
  });

  it("builds run commands", () => {
    expect(getRunCommand("pnpm", "dev")).toEqual({ command: "pnpm", args: ["run", "dev"] });
    expect(getRunCommand("npm", "dev")).toEqual({ command: "npm", args: ["run", "dev"] });
    expect(getRunCommand("yarn", "dev")).toEqual({ command: "yarn", args: ["dev"] });
    expect(getRunCommand("bun", "dev")).toEqual({ command: "bun", args: ["run", "dev"] });
  });
});

