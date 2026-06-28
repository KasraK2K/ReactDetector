import type { FrameworkId } from "../shared/types.js";
import { LogStore } from "./logStore.js";

const urlPattern = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[^\]]+\]|[\w.-]+):\d+(?:\/[^\s"'<>)]*)?/gi;

export function extractLocalUrls(text: string): string[] {
  const matches = stripAnsi(text).match(urlPattern) ?? [];
  return matches.map(normalizeLocalUrl);
}

export function getDefaultProbeUrls(frameworkId: FrameworkId): string[] {
  if (frameworkId === "next") {
    return range(3000, 3010).map((port) => `http://localhost:${port}`);
  }

  if (frameworkId === "vite-react") {
    return range(5173, 5190).map((port) => `http://localhost:${port}`);
  }

  return ["http://localhost:3000", "http://localhost:5173"];
}

export async function waitForTargetUrl(
  logs: LogStore,
  frameworkId: FrameworkId,
  timeoutMs = 30000
): Promise<string | undefined> {
  const existing = logs.all().flatMap((entry) => extractLocalUrls(entry.message))[0];
  if (existing) {
    return existing;
  }

  const deadline = Date.now() + timeoutMs;
  const candidates = getDefaultProbeUrls(frameworkId);

  return await new Promise((resolve) => {
    let resolved = false;

    const done = (url?: string) => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup();
      resolve(url);
    };

    const onEntry = (entry: { message: string }) => {
      const url = extractLocalUrls(entry.message)[0];
      if (url) {
        done(url);
      }
    };

    const probe = async () => {
      if (Date.now() > deadline) {
        done(undefined);
        return;
      }

      for (const candidate of candidates) {
        if (await canReach(candidate)) {
          done(candidate);
          return;
        }
      }
    };

    const interval = setInterval(() => {
      void probe();
    }, 750);
    const timeout = setTimeout(() => done(undefined), timeoutMs);

    const cleanup = () => {
      clearInterval(interval);
      clearTimeout(timeout);
      logs.off("entry", onEntry);
    };

    logs.on("entry", onEntry);
    void probe();
  });
}

async function canReach(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.status < 500;
  } catch {
    return false;
  }
}

function normalizeLocalUrl(url: string): string {
  return url.replace("0.0.0.0", "localhost").replace("[::]", "localhost");
}

export function stripAnsi(text: string): string {
  return text
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B[@-Z\\-_]/g, "");
}

function range(start: number, endInclusive: number): number[] {
  return Array.from({ length: endInclusive - start + 1 }, (_value, index) => start + index);
}
