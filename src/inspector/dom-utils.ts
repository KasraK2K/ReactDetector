import type { ReactSourceHint, SelectedElementPayload } from "../shared/types.js";

const maxSnippetLength = 1600;

export function createSelectedElementPayload(element: Element): SelectedElementPayload {
  const target = ensureRuntimeId(element);
  const rect = target.getBoundingClientRect();
  const role = getRole(target);

  return {
    rdId: target.getAttribute("data-rd-id") ?? "",
    route: window.location.pathname + window.location.search + window.location.hash,
    tag: target.tagName.toLowerCase(),
    role,
    accessibleName: getAccessibleName(target),
    textSnippet: getTextSnippet(target),
    selector: buildSelector(target),
    classList: Array.from(target.classList),
    classification: classifyElement(target),
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left)
    },
    nearby: getNearbyContext(target),
    domSnippet: getDomSnippet(target),
    react: getReactSourceHint(target)
  };
}

export function ensureRuntimeId(element: Element): Element {
  if (!element.getAttribute("data-rd-id")) {
    element.setAttribute("data-rd-id", `rd_${nextRuntimeId()}`);
  }
  return element;
}

export function assignRuntimeIds(root: ParentNode = document): void {
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));
  for (const element of elements) {
    if (isInspectableElement(element)) {
      ensureRuntimeId(element);
    }
  }
}

export function findSelectableElement(start: EventTarget | null): Element | null {
  if (!(start instanceof Element)) {
    return null;
  }

  let current: Element | null = start;
  while (current && current !== document.documentElement) {
    if (!isInspectableElement(current)) {
      current = current.parentElement;
      continue;
    }

    return normalizeSelectableElement(current);
  }

  return null;
}

export function classifyElement(element: Element): string[] {
  const tag = element.tagName.toLowerCase();
  const role = getRole(element);
  const classes = Array.from(element.classList).join(" ");
  const result = new Set<string>();

  if (tag === "button" || role === "button") result.add("button");
  if (tag === "a" || role === "link") result.add("link");
  if (["input", "select", "textarea"].includes(tag) || ["textbox", "combobox", "checkbox", "radio", "switch"].includes(role ?? "")) {
    result.add("input");
  }
  if (tag === "form" || role === "form") result.add("form");
  if (["section", "article", "main", "header", "footer", "nav", "aside"].includes(tag)) result.add("section");
  if (["main", "navigation", "banner", "contentinfo", "complementary", "region", "dialog"].includes(role ?? "")) result.add("landmark");
  if (tag === "dialog" || role === "dialog" || role === "alertdialog") result.add("dialog");
  if (element.getAttribute("onclick") || role === "menuitem" || role === "tab" || hasPointerCursor(element)) result.add("clickable");
  if (/(card|panel|tile|widget|module|summary|surface)/i.test(classes)) result.add("card");

  if (result.size === 0) {
    result.add("element");
  }

  return Array.from(result);
}

export function getRole(element: Element): string | undefined {
  const explicit = element.getAttribute("role");
  if (explicit) {
    return explicit;
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "a" && element.hasAttribute("href")) return "link";
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "header") return "banner";
  if (tag === "footer") return "contentinfo";
  if (tag === "aside") return "complementary";
  if (tag === "section") return "region";
  if (tag === "form") return "form";
  if (tag === "dialog") return "dialog";
  if (tag === "textarea") return "textbox";

  if (tag === "input") {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "range") return "slider";
    if (type === "button" || type === "submit" || type === "reset") return "button";
    return "textbox";
  }

  return undefined;
}

export function getAccessibleName(element: Element): string | undefined {
  const ariaLabel = cleanText(element.getAttribute("aria-label") ?? "");
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .map(cleanText)
      .filter(Boolean)
      .join(" ");
    if (label) return label;
  }

  const alt = cleanText(element.getAttribute("alt") ?? "");
  if (alt) return alt;

  const title = cleanText(element.getAttribute("title") ?? "");
  if (title) return title;

  if (element instanceof HTMLInputElement) {
    const label = findInputLabel(element);
    if (label) return label;
    const placeholder = cleanText(element.placeholder);
    if (placeholder) return placeholder;
    const value = cleanText(element.value);
    if (value && ["button", "submit", "reset"].includes(element.type)) return value;
  }

  return getTextSnippet(element);
}

export function buildSelector(element: Element): string {
  const dataSelectors = ["data-testid", "data-test", "data-cy", "name", "aria-label"];
  const id = element.getAttribute("id");
  if (id && document.querySelectorAll(`#${cssEscape(id)}`).length === 1) {
    return `#${cssEscape(id)}`;
  }

  for (const attr of dataSelectors) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const selector = `${element.tagName.toLowerCase()}[${attr}="${escapeAttribute(value)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement && parts.length < 6) {
    const tag = current.tagName.toLowerCase();
    const className = Array.from(current.classList)
      .filter((name) => /^[a-zA-Z_-][\w-]*$/.test(name))
      .slice(0, 2)
      .map((name) => `.${cssEscape(name)}`)
      .join("");
    const nth = nthOfType(current);
    parts.unshift(`${tag}${className}${nth > 1 ? `:nth-of-type(${nth})` : ""}`);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

export function getTextSnippet(element: Element, maxLength = 240): string | undefined {
  const text = cleanText(element.textContent ?? "");
  if (!text) {
    return undefined;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

export function getNearbyContext(element: Element): { headings: string[]; landmarks: string[] } {
  const headings = new Set<string>();
  const landmarks = new Set<string>();

  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    if (/^h[1-6]$/i.test(current.tagName)) {
      const text = getTextSnippet(current, 120);
      if (text) headings.add(text);
    }

    const heading = current.querySelector?.("h1,h2,h3,h4,h5,h6");
    if (heading) {
      const text = getTextSnippet(heading, 120);
      if (text) headings.add(text);
    }

    const role = getRole(current);
    if (role && ["main", "navigation", "banner", "contentinfo", "complementary", "region", "dialog", "form"].includes(role)) {
      const label = getLandmarkLabel(current, role);
      if (label) {
        landmarks.add(`${role}: ${label}`);
      }
    }

    current = current.parentElement;
  }

  return {
    headings: Array.from(headings).slice(0, 5),
    landmarks: Array.from(landmarks).slice(0, 5)
  };
}

export function getDomSnippet(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("script,style").forEach((node) => node.remove());
  const html = clone.outerHTML.replace(/\sdata-rd-id="[^"]*"/g, "");
  return html.length > maxSnippetLength ? `${html.slice(0, maxSnippetLength - 1)}...` : html;
}

export function getReactSourceHint(element: Element): ReactSourceHint {
  const fiber = findReactFiber(element);
  if (!fiber) {
    return { componentStack: [], confidence: "unavailable" };
  }

  const componentStack: string[] = [];
  let source: ReactSourceHint["source"];
  let current: unknown = fiber;

  while (current && typeof current === "object") {
    const record = current as Record<string, unknown>;
    const name = getFiberName(record);
    if (name && !componentStack.includes(name)) {
      componentStack.push(name);
    }

    if (!source && record._debugSource && typeof record._debugSource === "object") {
      const debugSource = record._debugSource as Record<string, unknown>;
      source = {
        fileName: typeof debugSource.fileName === "string" ? debugSource.fileName : undefined,
        lineNumber: typeof debugSource.lineNumber === "number" ? debugSource.lineNumber : undefined,
        columnNumber: typeof debugSource.columnNumber === "number" ? debugSource.columnNumber : undefined
      };
    }

    current = record.return;
  }

  return {
    componentStack: componentStack.slice(0, 8),
    source,
    confidence: componentStack.length > 0 ? (source ? "medium" : "low") : "unavailable"
  };
}

export function isInspectableElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (["html", "head", "body", "script", "style", "meta", "link", "title"].includes(tag)) {
    return false;
  }

  if (element.closest("[data-reactdetector-overlay]")) {
    return false;
  }

  return true;
}

function hasPointerCursor(element: Element): boolean {
  if (typeof window === "undefined" || !window.getComputedStyle) {
    return false;
  }

  return window.getComputedStyle(element).cursor === "pointer";
}

function normalizeSelectableElement(element: Element): Element {
  const interactiveAncestor = closestInteractiveAncestor(element);
  if (!interactiveAncestor || interactiveAncestor === element) {
    return element;
  }

  return isInlineControlPart(element) ? interactiveAncestor : element;
}

function closestInteractiveAncestor(element: Element): Element | null {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    if (!isInspectableElement(current)) {
      current = current.parentElement;
      continue;
    }

    if (isInteractiveElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function isInteractiveElement(element: Element): boolean {
  const classes = classifyElement(element);
  return classes.some((item) => item === "button" || item === "link" || item === "input" || item === "clickable");
}

function isInlineControlPart(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return ["span", "strong", "em", "small", "b", "i", "svg", "path", "use", "circle", "rect", "line", "polyline", "polygon"].includes(tag);
}

function findInputLabel(input: HTMLInputElement): string | undefined {
  if (input.id) {
    const label = document.querySelector(`label[for="${escapeAttribute(input.id)}"]`);
    const text = label ? getTextSnippet(label, 120) : undefined;
    if (text) return text;
  }

  const wrapped = input.closest("label");
  return wrapped ? getTextSnippet(wrapped, 120) : undefined;
}

function getLandmarkLabel(element: Element, role: string): string | undefined {
  const explicitLabel = cleanText(element.getAttribute("aria-label") ?? "");
  if (isUsefulLandmarkLabel(explicitLabel)) {
    return explicitLabel;
  }

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .map(cleanText)
      .filter(Boolean)
      .join(" ");
    if (isUsefulLandmarkLabel(label)) {
      return label;
    }
  }

  if (role === "main") {
    return undefined;
  }

  const heading = element.querySelector?.("h1,h2,h3,h4,h5,h6");
  const headingText = heading ? getTextSnippet(heading, 80) : undefined;
  return isUsefulLandmarkLabel(headingText) ? headingText : undefined;
}

function isUsefulLandmarkLabel(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.length <= 80 && value.split(/\s+/).length <= 12;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function nextRuntimeId(): number {
  const global = window as unknown as { __REACTDETECTOR_NEXT_ID__?: number };
  global.__REACTDETECTOR_NEXT_ID__ = (global.__REACTDETECTOR_NEXT_ID__ ?? 0) + 1;
  return global.__REACTDETECTOR_NEXT_ID__;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function nthOfType(element: Element): number {
  let count = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      count += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return count;
}

function findReactFiber(element: Element): unknown {
  const record = element as unknown as Record<string, unknown>;
  const key = Object.keys(record).find(
    (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$")
  );
  return key ? record[key] : undefined;
}

function getFiberName(fiber: Record<string, unknown>): string | undefined {
  const candidates = [fiber.elementType, fiber.type];
  for (const candidate of candidates) {
    if (typeof candidate === "function" && candidate.name) {
      return candidate.name;
    }

    if (typeof candidate === "object" && candidate !== null) {
      const record = candidate as Record<string, unknown>;
      if (typeof record.displayName === "string") return record.displayName;
      if (typeof record.name === "string") return record.name;
    }

    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return undefined;
}
