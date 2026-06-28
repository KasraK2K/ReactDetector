import { describe, expect, it } from "vitest";
import type { InspectorServerState } from "../../src/shared/types.js";
import { DEFAULT_VIEWPORTS } from "../../src/shared/viewports.js";
import { createContextPayload, createMarkdownPrompt } from "../../src/ui/context.js";

describe("context payload", () => {
  const state: InspectorServerState = {
    targetUrl: "http://localhost:5173",
    proxyUrl: "http://localhost:4545",
    uiUrl: "http://localhost:4545/__rd/ui",
    defaultIssueViewports: [],
    startedAt: "2026-06-28T00:00:00.000Z",
    viewports: DEFAULT_VIEWPORTS,
    project: {
      projectPath: "D:/app",
      packageManager: "pnpm",
      framework: {
        id: "vite-react",
        label: "Vite React",
        confidence: "high"
      }
    }
  };

  it("creates an unspecified viewport payload without selection", () => {
    const payload = createContextPayload({
      state,
      activeViewport: DEFAULT_VIEWPORTS[0],
      allIssueViewports: false,
      issueViewportIds: [],
      selectedElement: null,
      userPrompt: "Fix spacing"
    });

    expect(payload.issueViewportScope.mode).toBe("unspecified");
    expect(payload.selectedElement).toBeNull();
    expect(payload.userPrompt).toBe("Fix spacing");
  });

  it("creates markdown with JSON context", () => {
    const payload = createContextPayload({
      state,
      activeViewport: DEFAULT_VIEWPORTS[1],
      allIssueViewports: false,
      issueViewportIds: ["mobile"],
      selectedElement: null,
      userPrompt: "Fix mobile spacing"
    });

    expect(createMarkdownPrompt(payload)).toContain("```json");
    expect(createMarkdownPrompt(payload)).toContain('"mode": "specific"');
  });
});

