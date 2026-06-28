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

    expect(payload.viewport.issueScope.mode).toBe("unspecified");
    expect(payload.selected).toBeNull();
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

    expect(createMarkdownPrompt(payload, "Fix mobile spacing")).toContain("```json");
    expect(createMarkdownPrompt(payload, "Fix mobile spacing")).toContain('"mode": "specific"');
    expect(createMarkdownPrompt(payload, "Fix mobile spacing")).toContain(
      "The target project framework detected from package.json is Vite React."
    );
    expect(createMarkdownPrompt(payload, "Fix mobile spacing")).not.toContain("React or Next.js");
  });

  it("keeps selected element context compact", () => {
    const payload = createContextPayload({
      state,
      activeViewport: DEFAULT_VIEWPORTS[1],
      allIssueViewports: false,
      issueViewportIds: ["mobile"],
      selectedElement: {
        rdId: "rd_1",
        route: "/settings",
        tag: "button",
        role: "button",
        accessibleName: "Save settings",
        textSnippet: "Save settings",
        selector: 'button[aria-label="Save settings"]',
        classList: ["one", "two"],
        classification: ["button"],
        boundingBox: {
          x: 1,
          y: 2,
          width: 3,
          height: 4,
          top: 2,
          right: 4,
          bottom: 6,
          left: 1
        },
        nearby: {
          headings: ["Settings"],
          landmarks: [
            "region: Settings",
            "main: Mock workspace AI Dashboard Builder Metrics Plans Review Current project Revenue operations dashboard A compact mock app with buttons forms sections cards and responsive states"
          ]
        },
        domSnippet: "<button class=\"one two\">Save settings</button>",
        react: {
          componentStack: ["button", "SaveButton"],
          confidence: "low"
        }
      },
      userPrompt: "Fix spacing"
    });

    expect(payload.selected).toEqual({
      selector: 'button[aria-label="Save settings"]',
      tag: "button",
      role: "button",
      name: "Save settings",
      categories: ["button"],
      nearbyHeadings: ["Settings"],
      nearbyLandmarks: ["region: Settings"],
      componentStack: ["SaveButton"]
    });
    expect(JSON.stringify(payload)).not.toContain("Mock workspace AI Dashboard Builder Metrics");
    expect(JSON.stringify(payload)).not.toContain("rd_1");
    expect(JSON.stringify(payload)).not.toContain("boundingBox");
    expect(JSON.stringify(payload)).not.toContain("classList");
    expect(JSON.stringify(payload)).not.toContain("domSnippet");
  });
});
