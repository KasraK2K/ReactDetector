import {
  assignRuntimeIds,
  createSelectedElementPayload,
  findSelectableElement,
  isInspectableElement
} from "./dom-utils.js";

const overlay = document.createElement("div");
overlay.setAttribute("data-reactdetector-overlay", "true");
overlay.style.cssText = [
  "position:fixed",
  "z-index:2147483647",
  "pointer-events:none",
  "border:2px solid #21a67a",
  "box-shadow:0 0 0 1px rgba(33,166,122,.25),0 8px 24px rgba(0,0,0,.18)",
  "border-radius:4px",
  "transition:transform .08s ease,width .08s ease,height .08s ease,opacity .08s ease",
  "opacity:0"
].join(";");

const label = document.createElement("div");
label.setAttribute("data-reactdetector-overlay", "true");
label.style.cssText = [
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

document.documentElement.append(overlay, label);
assignRuntimeIds();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) {
        assignRuntimeIds(node);
      }
    });
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener(
  "mousemove",
  (event) => {
    const target = findSelectableElement(event.target);
    if (!target || !isInspectableElement(target)) {
      hideOverlay();
      return;
    }

    showOverlay(target);
  },
  true
);

window.addEventListener(
  "scroll",
  () => {
    hideOverlay();
  },
  true
);

window.addEventListener(
  "click",
  (event) => {
    const target = findSelectableElement(event.target);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showOverlay(target);

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

function showOverlay(element: Element): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hideOverlay();
    return;
  }

  overlay.style.opacity = "1";
  overlay.style.width = `${Math.round(rect.width)}px`;
  overlay.style.height = `${Math.round(rect.height)}px`;
  overlay.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;

  const tag = element.tagName.toLowerCase();
  const text = element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "";
  label.textContent = text ? `${tag} - ${text.slice(0, 70)}` : tag;
  label.style.opacity = "1";
  label.style.transform = `translate(${Math.round(rect.left)}px, ${Math.max(6, Math.round(rect.top) - 28)}px)`;
}

function hideOverlay(): void {
  overlay.style.opacity = "0";
  label.style.opacity = "0";
}
