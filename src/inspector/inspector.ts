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
  "z-index:2147483647",
  "pointer-events:none",
  "border:2px solid #21a67a",
  "box-shadow:0 0 0 1px rgba(33,166,122,.25),0 8px 24px rgba(0,0,0,.18)",
  "border-radius:4px",
  "transition:transform .08s ease,width .08s ease,height .08s ease,opacity .08s ease",
  "opacity:0"
].join(";");

const hoverLabel = document.createElement("div");
hoverLabel.setAttribute("data-reactdetector-overlay", "true");
hoverLabel.setAttribute("data-reactdetector-hover-label", "true");
hoverLabel.style.cssText = [
  "position:fixed",
  "z-index:2147483647",
  "pointer-events:none",
  "background:#161616",
  "color:#f6f1e8",
  "border:1px solid rgba(255,255,255,.15)",
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

let selectedElement: Element | null = null;
let selectionMode = false;

document.documentElement.append(hoverBox, hoverLabel, selectedBox, selectedLabel);
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

window.addEventListener(
  "mousemove",
  (event) => {
    if (!selectionMode) {
      hideHoverOverlay();
      return;
    }

    const target = findSelectableElement(event.target);
    if (!target || !isInspectableElement(target)) {
      hideHoverOverlay();
      return;
    }

    showHoverOverlay(target);
  },
  true
);

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
    selectedElement = target;
    showHoverOverlay(target);
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

function showHoverOverlay(element: Element): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hideHoverOverlay();
    return;
  }

  placeBox(hoverBox, rect);

  const tag = element.tagName.toLowerCase();
  const text = element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "";
  setTextIfChanged(hoverLabel, text ? `${tag} - ${text.slice(0, 70)}` : tag);
  placeLabel(hoverLabel, rect, "left");
}

function showSelectedOverlay(element: Element): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hideSelectedOverlay();
    return;
  }

  placeBox(selectedBox, rect);

  const tag = element.tagName.toLowerCase();
  const name = element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || tag;
  setTextIfChanged(selectedLabel, `Selected: ${name.slice(0, 54)}`);
  placeLabel(selectedLabel, rect, "right");
}

function updateSelectedOverlay(): void {
  if (!selectedElement || !selectedElement.isConnected) {
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
