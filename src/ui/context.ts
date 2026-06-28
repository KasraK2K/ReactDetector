import type { ContextPayload, InspectorServerState, SelectedElementPayload } from "../shared/types.js";
import { type ActiveViewport, serializeIssueViewportScope, type ViewportPresetId } from "../shared/viewports.js";

export function createContextPayload(options: {
  state: InspectorServerState;
  activeViewport: ActiveViewport;
  allIssueViewports: boolean;
  issueViewportIds: ViewportPresetId[];
  selectedElement: SelectedElementPayload | null;
  userPrompt: string;
}): ContextPayload {
  const selected = options.selectedElement ? compactSelectedElement(options.selectedElement) : null;

  return {
    project: {
      path: options.state.project.projectPath,
      framework: options.state.project.framework.label,
      packageManager: options.state.project.packageManager
    },
    location: {
      targetUrl: options.state.targetUrl,
      route: options.selectedElement?.route ?? "/"
    },
    viewport: {
      current: options.activeViewport,
      issueScope: serializeIssueViewportScope(options.issueViewportIds, options.allIssueViewports)
    },
    selected,
    generatedAt: new Date().toISOString()
  };
}

export function createMarkdownPrompt(payload: ContextPayload, userPrompt: string): string {
  const request = userPrompt.trim() || "Use the selected UI context to identify the relevant component and propose a focused fix.";
  return [
    "I am working on a React or Next.js UI. Use this selected UI context to understand exactly which item I mean.",
    "",
    "Request:",
    request,
    "",
    "ReactDetector context:",
    "```json",
    JSON.stringify(payload, null, 2),
    "```"
  ].join("\n");
}

function compactSelectedElement(element: SelectedElementPayload): ContextPayload["selected"] {
  const componentStack = element.react.componentStack.filter(isComponentName).slice(0, 6);
  const source = element.react.source?.fileName ? element.react.source : undefined;
  const text = element.textSnippet && element.textSnippet !== element.accessibleName ? element.textSnippet : undefined;
  const landmarks = element.nearby.landmarks.filter(isUsefulLandmark);

  return omitEmpty({
    selector: element.selector,
    tag: element.tag,
    role: element.role,
    name: element.accessibleName,
    text,
    categories: element.classification.length > 0 ? element.classification : undefined,
    nearbyHeadings: element.nearby.headings.length > 0 ? element.nearby.headings : undefined,
    nearbyLandmarks: landmarks.length > 0 ? landmarks : undefined,
    componentStack: componentStack.length > 0 ? componentStack : undefined,
    source
  });
}

function omitEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === "") {
        return false;
      }

      return !(Array.isArray(entry) && entry.length === 0);
    })
  ) as T;
}

function isComponentName(value: string): boolean {
  return /^[A-Z]/.test(value) && !["React", "Fragment", "StrictMode"].includes(value);
}

function isUsefulLandmark(value: string): boolean {
  const [, label = ""] = value.split(/:\s+/, 2);
  return value.length <= 96 && label.length > 0 && label.length <= 80 && label.split(/\s+/).length <= 12;
}
