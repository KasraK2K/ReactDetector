import type { ActiveViewport, IssueViewportScope, ViewportPreset, ViewportPresetId } from "./viewports.js";

export type FrameworkId = "next" | "vite-react" | "cra" | "react-unknown" | "unknown";
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type FrameworkInfo = {
  id: FrameworkId;
  label: string;
  confidence: "high" | "medium" | "low";
};

export type ProjectInfo = {
  projectPath?: string;
  packageManager?: PackageManager;
  framework: FrameworkInfo;
  script?: string;
};

export type ReactSourceHint = {
  componentStack: string[];
  source?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  confidence: "high" | "medium" | "low" | "unavailable";
};

export type SelectedElementPayload = {
  rdId: string;
  route: string;
  tag: string;
  role?: string;
  accessibleName?: string;
  textSnippet?: string;
  selector: string;
  classList: string[];
  classification: string[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  nearby: {
    headings: string[];
    landmarks: string[];
  };
  domSnippet: string;
  react: ReactSourceHint;
};

export type InspectorServerState = {
  targetUrl: string;
  proxyUrl: string;
  uiUrl: string;
  project: ProjectInfo;
  viewports: ViewportPreset[];
  defaultIssueViewports: ViewportPresetId[];
  startedAt: string;
};

export type ContextPayload = {
  project: ProjectInfo;
  targetUrl: string;
  proxyRoute: string;
  currentViewport: ActiveViewport;
  issueViewportScope: IssueViewportScope;
  selectedElement: SelectedElementPayload | null;
  userPrompt: string;
  generatedAt: string;
};

export type LogEntry = {
  id: number;
  timestamp: string;
  source: "reactdetector" | "target";
  stream: "info" | "stdout" | "stderr" | "error";
  message: string;
};
