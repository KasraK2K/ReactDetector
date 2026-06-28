export type ViewportPresetId = "mobile" | "tablet" | "laptop" | "desktop";

export type ViewportPreset = {
  id: ViewportPresetId;
  label: string;
  width: number;
  height: number;
};

export type CustomViewport = {
  id: "custom";
  label: string;
  width: number;
  height: number;
};

export type ActiveViewport = ViewportPreset | CustomViewport;

export const DEFAULT_VIEWPORTS: ViewportPreset[] = [
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "laptop", label: "Laptop", width: 1280, height: 800 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 }
];

export type IssueViewportScope =
  | { mode: "unspecified"; viewports: [] }
  | { mode: "all"; viewports: ViewportPresetId[] }
  | { mode: "specific"; viewports: ViewportPresetId[] };

export function parseViewportIds(input?: string): ViewportPresetId[] {
  if (!input) {
    return [];
  }

  const allowed = new Set(DEFAULT_VIEWPORTS.map((viewport) => viewport.id));
  return input
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ViewportPresetId => allowed.has(value as ViewportPresetId));
}

export function serializeIssueViewportScope(
  selectedIds: ViewportPresetId[],
  allSelected: boolean
): IssueViewportScope {
  if (allSelected) {
    return { mode: "all", viewports: DEFAULT_VIEWPORTS.map((viewport) => viewport.id) };
  }

  if (selectedIds.length === 0) {
    return { mode: "unspecified", viewports: [] };
  }

  return { mode: "specific", viewports: selectedIds };
}

export function findViewportPreset(id: string): ViewportPreset | undefined {
  return DEFAULT_VIEWPORTS.find((viewport) => viewport.id === id);
}

