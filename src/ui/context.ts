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
  return {
    project: options.state.project,
    targetUrl: options.state.targetUrl,
    proxyRoute: options.selectedElement?.route ?? "/",
    currentViewport: options.activeViewport,
    issueViewportScope: serializeIssueViewportScope(options.issueViewportIds, options.allIssueViewports),
    selectedElement: options.selectedElement,
    userPrompt: options.userPrompt,
    generatedAt: new Date().toISOString()
  };
}

export function createMarkdownPrompt(payload: ContextPayload): string {
  const request = payload.userPrompt.trim() || "Use the selected UI context to identify the relevant component and propose a focused fix.";
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

