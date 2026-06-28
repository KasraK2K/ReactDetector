import express from "express";
import http from "node:http";
import httpProxy from "http-proxy";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_VIEWPORTS } from "../shared/viewports.js";
import type { FrameworkInfo, InspectorServerState, ProjectInfo } from "../shared/types.js";
import type { ViewportPresetId } from "../shared/viewports.js";
import { LogStore } from "../core/logStore.js";
import { filterPreviewHeaders, injectInspectorScript } from "./htmlRewrite.js";

export type InspectorServerOptions = {
  targetUrl: string;
  project: ProjectInfo;
  logs: LogStore;
  uiPort?: number;
  defaultIssueViewports?: ViewportPresetId[];
};

export type InspectorServer = {
  port: number;
  uiUrl: string;
  proxyUrl: string;
  close: () => Promise<void>;
};

export async function startInspectorServer(options: InspectorServerOptions): Promise<InspectorServer> {
  const port = await findAvailablePort(options.uiPort ?? 4545);
  const app = express();
  const distRoot = getDistRoot();
  const uiDir = path.join(distRoot, "ui");
  const inspectorScript = path.join(distRoot, "inspector", "inspector.js");
  const uiUrl = `http://localhost:${port}/__rd/ui/`;
  const proxyUrl = `http://localhost:${port}/`;
  const startedAt = new Date().toISOString();

  const state: InspectorServerState = {
    targetUrl: options.targetUrl,
    proxyUrl,
    uiUrl,
    project: options.project,
    viewports: DEFAULT_VIEWPORTS,
    defaultIssueViewports: options.defaultIssueViewports ?? [],
    startedAt
  };

  app.disable("x-powered-by");

  app.get("/__rd/state", (_req, res) => {
    res.json(state);
  });

  app.get("/__rd/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    const send = (entry: unknown) => {
      res.write(`event: log\n`);
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    options.logs.all().forEach(send);
    const onEntry = (entry: unknown) => send(entry);
    options.logs.on("entry", onEntry);

    req.on("close", () => {
      options.logs.off("entry", onEntry);
    });
  });

  app.get("/__rd/inspector.js", (_req, res) => {
    res.type("application/javascript");
    res.sendFile(inspectorScript);
  });

  app.use("/__rd/ui", express.static(uiDir, { fallthrough: true }));
  app.get(["/__rd/ui", "/__rd/ui/*"], (_req, res) => {
    res.sendFile(path.join(uiDir, "index.html"));
  });

  const proxy = httpProxy.createProxyServer({
    target: options.targetUrl,
    changeOrigin: true,
    secure: false,
    ws: true,
    selfHandleResponse: true
  });

  proxy.on("proxyReq", (proxyReq) => {
    proxyReq.setHeader("accept-encoding", "identity");
  });

  proxy.on("proxyRes", (proxyRes, req, res) => {
    const response = res as http.ServerResponse;
    const contentType = String(proxyRes.headers["content-type"] ?? "");
    const isHtml = contentType.includes("text/html");

    if (!isHtml) {
      const headers = filterPreviewHeaders(proxyRes.headers, false);
      response.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(response);
      return;
    }

    const chunks: Buffer[] = [];
    proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
    proxyRes.on("end", () => {
      const original = Buffer.concat(chunks).toString("utf8");
      const rewritten = injectInspectorScript(original);
      const headers = filterPreviewHeaders(proxyRes.headers, true);
      headers["content-type"] = contentType;
      response.writeHead(proxyRes.statusCode ?? 200, headers);
      response.end(rewritten);
    });
    proxyRes.on("error", (error) => {
      options.logs.add("reactdetector", "error", `Proxy response failed: ${error.message}`);
      if (!response.headersSent) {
        response.writeHead(502);
      }
      response.end("ReactDetector proxy response failed.");
    });
  });

  proxy.on("error", (error, _req, res) => {
    options.logs.add("reactdetector", "error", `Proxy failed: ${error.message}`);
    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("ReactDetector could not reach the target app.");
    }
  });

  app.use((req, res) => {
    proxy.web(req, res);
  });

  const server = http.createServer(app);
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/__rd/")) {
      socket.destroy();
      return;
    }
    proxy.ws(req, socket, head);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  options.logs.add("reactdetector", "info", `Inspector UI ready at ${uiUrl}`);

  return {
    port,
    uiUrl,
    proxyUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

export function projectInfoForAttach(projectPath: string | undefined, framework: FrameworkInfo): ProjectInfo {
  return {
    projectPath,
    framework
  };
}

async function findAvailablePort(preferredPort: number): Promise<number> {
  for (let port = preferredPort; port < preferredPort + 40; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`No available local port found near ${preferredPort}.`);
}

async function canListen(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function getDistRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../..");
}
