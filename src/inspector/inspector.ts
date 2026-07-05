import {
  assignRuntimeIds,
  createSelectedElementPayload,
  findSelectableElement,
  isInspectableElement
} from "./dom-utils.js";

const hoverBox = document.createElement("div");
hoverBox.setAttribute("data-reactdetector-overlay", "true");
hoverBox.setAttribute("data-reactdetector-hover-box", "true");
hoverBox.style.cssText = [
  "position:fixed",
  "top:0",
  "left:0",
  "z-index:2147483647",
  "pointer-events:none",
  "border:2px solid #4c9ffe",
  "background:rgba(76,159,254,.10)",
  "box-shadow:0 0 0 1px rgba(76,159,254,.30),0 8px 24px rgba(0,0,0,.18)",
  "border-radius:4px",
  "transition:transform .08s ease,width .08s ease,height .08s ease,opacity .08s ease",
  "opacity:0"
].join(";");

const hoverLabel = document.createElement("div");
hoverLabel.setAttribute("data-reactdetector-overlay", "true");
hoverLabel.setAttribute("data-reactdetector-hover-label", "true");
hoverLabel.style.cssText = [
  "position:fixed",
  "top:0",
  "left:0",
  "z-index:2147483647",
  "pointer-events:none",
  "background:#0d315f",
  "color:#f4f9ff",
  "border:1px solid rgba(255,255,255,.24)",
  "border-radius:4px",
  "padding:3px 6px",
  "font:12px/1.3 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif",
  "opacity:0",
  "max-width:320px",
  "white-space:nowrap",
  "overflow:hidden",
  "text-overflow:ellipsis"
].join(";");

const selectedBox = document.createElement("div");
selectedBox.setAttribute("data-reactdetector-overlay", "true");
selectedBox.setAttribute("data-reactdetector-selected-box", "true");
selectedBox.style.cssText = [
  "position:fixed",
  "top:0",
  "left:0",
  "z-index:2147483646",
  "pointer-events:none",
  "border:2px solid #f0b84f",
  "box-shadow:0 0 0 3px rgba(240,184,79,.18),0 12px 32px rgba(0,0,0,.16)",
  "border-radius:6px",
  "transition:transform .12s ease,width .12s ease,height .12s ease,opacity .12s ease",
  "opacity:0"
].join(";");

const selectedLabel = document.createElement("div");
selectedLabel.setAttribute("data-reactdetector-overlay", "true");
selectedLabel.setAttribute("data-reactdetector-selected-label", "true");
selectedLabel.style.cssText = [
  "position:fixed",
  "top:0",
  "left:0",
  "z-index:2147483647",
  "pointer-events:none",
  "background:#f0b84f",
  "color:#201b13",
  "border:1px solid rgba(32,27,19,.16)",
  "border-radius:4px",
  "padding:3px 7px",
  "font:700 12px/1.3 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif",
  "opacity:0",
  "max-width:320px",
  "white-space:nowrap",
  "overflow:hidden",
  "text-overflow:ellipsis",
  "box-shadow:0 8px 20px rgba(0,0,0,.16)"
].join(";");

const selectedTargetStyle = document.createElement("style");
selectedTargetStyle.setAttribute("data-reactdetector-overlay", "true");
selectedTargetStyle.textContent = `
  [data-reactdetector-hover-target="true"] {
    outline: 2px solid #4c9ffe !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 5px rgba(76,159,254,.20) !important;
  }

  [data-reactdetector-selected-target="true"] {
    outline: 3px solid #f0b84f !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 6px rgba(240,184,79,.22), 0 10px 28px rgba(0,0,0,.18) !important;
  }
`;

let selectedElement: Element | null = null;
let hoverElement: Element | null = null;
let selectionMode = false;

document.documentElement.append(hoverBox, hoverLabel, selectedBox, selectedLabel, selectedTargetStyle);
assignRuntimeIds();

const observer = new MutationObserver((mutations) => {
  let shouldUpdateSelectedOverlay = false;

  for (const mutation of mutations) {
    if (isOverlayNode(mutation.target)) {
      continue;
    }

    mutation.addedNodes.forEach((node) => {
      if (isOverlayNode(node)) {
        return;
      }

      if (node instanceof Element) {
        assignRuntimeIds(node);
        shouldUpdateSelectedOverlay = true;
      }
    });
  }

  if (shouldUpdateSelectedOverlay) {
    updateSelectedOverlay();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener("pointermove", handlePointerMove, true);
window.addEventListener("mousemove", handlePointerMove, true);
window.addEventListener("mouseleave", hideHoverOverlay, true);

window.addEventListener(
  "scroll",
  () => {
    hideHoverOverlay();
    updateSelectedOverlay();
  },
  true
);

window.addEventListener("resize", updateSelectedOverlay, true);

window.addEventListener("message", (event) => {
  if (event.data?.source !== "reactdetector" || event.data?.type !== "rd:selection-mode") {
    return;
  }

  setSelectionMode(Boolean(event.data.enabled));
});

window.addEventListener(
  "click",
  (event) => {
    if (!selectionMode) {
      return;
    }

    const target = findSelectableElement(event.target);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedElement(target);
    showSelectedOverlay(target);
    setSelectionMode(false);

    window.parent.postMessage(
      {
        source: "reactdetector",
        type: "rd:selected",
        payload: createSelectedElementPayload(target)
      },
      "*"
    );
  },
  true
);

function setSelectionMode(enabled: boolean): void {
  selectionMode = enabled;
  document.documentElement.style.cursor = enabled ? "crosshair" : "";

  if (!enabled) {
    hideHoverOverlay();
  }
}

function handlePointerMove(event: Event): void {
  if (!selectionMode) {
    hideHoverOverlay();
    return;
  }

  const target = findSelectableElement(event.target);
  if (!target || !isInspectableElement(target)) {
    hideHoverOverlay();
    return;
  }

  setHoverElement(target);
  showHoverOverlay(target);
}

function showHoverOverlay(element: Element): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hideHoverOverlay();
    return;
  }

  placeBox(hoverBox, rect);

  setTextIfChanged(hoverLabel, `Select: ${formatElementLabel(element)}`);
  placeLabel(hoverLabel, rect, "left");
}

function showSelectedOverlay(element: Element): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hideSelectedOverlay();
    return;
  }

  placeBox(selectedBox, rect);

  setTextIfChanged(selectedLabel, `Selected: ${formatElementLabel(element).slice(0, 64)}`);
  placeLabel(selectedLabel, rect, "right");
}

function setHoverElement(element: Element): void {
  if (hoverElement && hoverElement !== element) {
    hoverElement.removeAttribute("data-reactdetector-hover-target");
  }

  hoverElement = element;
  hoverElement.setAttribute("data-reactdetector-hover-target", "true");
}

function setSelectedElement(element: Element): void {
  if (selectedElement && selectedElement !== element) {
    selectedElement.removeAttribute("data-reactdetector-selected-target");
  }

  selectedElement = element;
  selectedElement.setAttribute("data-reactdetector-selected-target", "true");
}

function updateSelectedOverlay(): void {
  if (!selectedElement || !selectedElement.isConnected) {
    selectedElement?.removeAttribute("data-reactdetector-selected-target");
    selectedElement = null;
    hideSelectedOverlay();
    return;
  }

  showSelectedOverlay(selectedElement);
}

function placeBox(box: HTMLElement, rect: DOMRect): void {
  box.style.opacity = "1";
  box.style.width = `${Math.round(rect.width)}px`;
  box.style.height = `${Math.round(rect.height)}px`;
  box.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
}

function placeLabel(label: HTMLElement, rect: DOMRect, alignment: "left" | "right"): void {
  const labelTop = Math.max(6, Math.round(rect.top) - 28);
  const labelLeft =
    alignment === "right" ? Math.max(6, Math.round(rect.right) - Math.min(220, label.offsetWidth || 92)) : Math.round(rect.left);

  label.style.opacity = "1";
  label.style.transform = `translate(${labelLeft}px, ${labelTop}px)`;
}

function hideHoverOverlay(): void {
  hoverElement?.removeAttribute("data-reactdetector-hover-target");
  hoverElement = null;
  hoverBox.style.opacity = "0";
  hoverLabel.style.opacity = "0";
}

function hideSelectedOverlay(): void {
  selectedBox.style.opacity = "0";
  selectedLabel.style.opacity = "0";
}

function setTextIfChanged(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

function isOverlayNode(node: Node): boolean {
  if (node instanceof Element) {
    return Boolean(node.closest("[data-reactdetector-overlay]"));
  }

  return Boolean(node.parentElement?.closest("[data-reactdetector-overlay]"));
}

function formatElementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((name) => !name.startsWith("rd-") && !name.startsWith("reactdetector"))
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  const text = element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "";
  const name = text ? ` - ${text.slice(0, 70)}` : "";

  return `${tag}${id}${classes}${name}`;
}
