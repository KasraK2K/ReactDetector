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
  project: {
    path?: string;
    framework: string;
    packageManager?: PackageManager;
  };
  location: {
    targetUrl: string;
    route: string;
  };
  viewport: {
    current: ActiveViewport;
    issueScope: IssueViewportScope;
  };
  selected: {
    selector: string;
    tag: string;
    role?: string;
    name?: string;
    text?: string;
    categories?: string[];
    nearbyHeadings?: string[];
    nearbyLandmarks?: string[];
    componentStack?: string[];
    source?: {
      fileName?: string;
      lineNumber?: number;
      columnNumber?: number;
    };
  } | null;
  generatedAt: string;
};

export type LogEntry = {
  id: number;
  timestamp: string;
  source: "reactdetector" | "target";
  stream: "info" | "stdout" | "stderr" | "error";
  message: string;
};
