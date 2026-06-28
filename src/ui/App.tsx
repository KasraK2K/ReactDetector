import {
  Bug,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Logs,
  MonitorSmartphone,
  RefreshCw
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InspectorServerState, LogEntry, SelectedElementPayload } from "../shared/types.js";
import { DEFAULT_VIEWPORTS, type ActiveViewport, type ViewportPresetId } from "../shared/viewports.js";
import { createContextPayload, createMarkdownPrompt } from "./context.js";

const fallbackViewport = DEFAULT_VIEWPORTS.find((viewport) => viewport.id === "laptop") ?? DEFAULT_VIEWPORTS[0];

export function App() {
  const [state, setState] = useState<InspectorServerState | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElementPayload | null>(null);
  const [activeViewport, setActiveViewport] = useState<ActiveViewport>(fallbackViewport);
  const [issueViewportIds, setIssueViewportIds] = useState<ViewportPresetId[]>([]);
  const [allIssueViewports, setAllIssueViewports] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [customSize, setCustomSize] = useState({ width: 1024, height: 768 });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/__rd/state")
      .then((response) => response.json())
      .then((nextState: InspectorServerState) => {
        setState(nextState);
        setIssueViewportIds(nextState.defaultIssueViewports ?? []);
      })
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    const events = new EventSource("/__rd/events");
    events.addEventListener("log", (event) => {
      const entry = JSON.parse((event as MessageEvent).data) as LogEntry;
      setLogs((current) => [...current.slice(-160), entry]);
    });

    return () => events.close();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.source !== "reactdetector" || event.data?.type !== "rd:selected") {
        return;
      }

      setSelectedElement(event.data.payload as SelectedElementPayload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const contextPayload = useMemo(() => {
    if (!state) {
      return null;
    }

    return createContextPayload({
      state,
      activeViewport,
      allIssueViewports,
      issueViewportIds,
      selectedElement,
      userPrompt: prompt
    });
  }, [activeViewport, allIssueViewports, issueViewportIds, prompt, selectedElement, state]);

  const markdownPrompt = useMemo(() => {
    return contextPayload ? createMarkdownPrompt(contextPayload) : "";
  }, [contextPayload]);

  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.location.reload();
    }
  };

  const copyContext = async () => {
    try {
      await navigator.clipboard.writeText(markdownPrompt);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  };

  const setCustomViewport = () => {
    setActiveViewport({
      id: "custom",
      label: "Custom",
      width: clampDimension(customSize.width),
      height: clampDimension(customSize.height)
    });
  };

  const toggleIssueViewport = (id: ViewportPresetId) => {
    setAllIssueViewports(false);
    setIssueViewportIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  if (!state) {
    return (
      <main className="boot">
        <div className="boot-mark">
          <Bug size={22} />
        </div>
        <p>Connecting to ReactDetector...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Bug size={19} />
          <div>
            <strong>ReactDetector</strong>
            <span>{state.project.framework.label}</span>
          </div>
        </div>

        <div className="target">
          <ExternalLink size={14} />
          <span>{state.targetUrl}</span>
        </div>

        <div className="toolbar">
          <button className="icon-button" onClick={refreshPreview} title="Refresh preview" aria-label="Refresh preview">
            <RefreshCw size={16} />
          </button>
          <button
            className={`icon-button ${showLogs ? "is-active" : ""}`}
            onClick={() => setShowLogs((value) => !value)}
            title="Logs"
            aria-label="Logs"
          >
            <Logs size={16} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="preview-column">
          <div className="viewport-bar">
            <div className="viewport-label">
              <MonitorSmartphone size={15} />
              <span>Preview</span>
            </div>
            <div className="viewport-presets">
              {state.viewports.map((viewport) => (
                <button
                  key={viewport.id}
                  className={activeViewport.id === viewport.id ? "is-selected" : ""}
                  onClick={() => setActiveViewport(viewport)}
                >
                  {viewport.label}
                </button>
              ))}
            </div>
            <div className="custom-viewport">
              <input
                aria-label="Custom width"
                value={customSize.width}
                type="number"
                min={240}
                max={2400}
                onChange={(event) => setCustomSize((value) => ({ ...value, width: Number(event.target.value) }))}
              />
              <span>x</span>
              <input
                aria-label="Custom height"
                value={customSize.height}
                type="number"
                min={240}
                max={2000}
                onChange={(event) => setCustomSize((value) => ({ ...value, height: Number(event.target.value) }))}
              />
              <button onClick={setCustomViewport}>Custom</button>
            </div>
          </div>

          <div className="preview-stage">
            <div
              className="viewport-frame"
              style={{
                width: `${activeViewport.width}px`,
                height: `${activeViewport.height}px`
              }}
            >
              <iframe ref={iframeRef} title="ReactDetector preview" src="/" />
            </div>
          </div>
        </section>

        <aside className="context-panel">
          <section className="panel-section selected-section">
            <div className="section-heading">
              <span>Selected</span>
              {selectedElement ? <strong>{selectedElement.tag}</strong> : <strong>None</strong>}
            </div>
            {selectedElement ? (
              <div className="selection-details">
                <b>{selectedElement.accessibleName ?? selectedElement.textSnippet ?? selectedElement.selector}</b>
                <span>{selectedElement.selector}</span>
                <div className="chips">
                  {selectedElement.classification.map((item) => (
                    <em key={item}>{item}</em>
                  ))}
                </div>
                <dl>
                  <dt>Route</dt>
                  <dd>{selectedElement.route}</dd>
                  <dt>Role</dt>
                  <dd>{selectedElement.role ?? "unknown"}</dd>
                  <dt>Component</dt>
                  <dd>{selectedElement.react.componentStack[0] ?? selectedElement.react.confidence}</dd>
                </dl>
              </div>
            ) : (
              <p className="muted">Click an item in the preview.</p>
            )}
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>Issue Scope</span>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={allIssueViewports}
                onChange={(event) => {
                  setAllIssueViewports(event.target.checked);
                  if (event.target.checked) {
                    setIssueViewportIds([]);
                  }
                }}
              />
              <span>All viewports</span>
            </label>
            <div className="scope-grid">
              {state.viewports.map((viewport) => (
                <label key={viewport.id} className="check-row compact">
                  <input
                    type="checkbox"
                    disabled={allIssueViewports}
                    checked={issueViewportIds.includes(viewport.id)}
                    onChange={() => toggleIssueViewport(viewport.id)}
                  />
                  <span>{viewport.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="panel-section composer">
            <div className="section-heading">
              <span>Prompt</span>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the issue for the selected item."
            />
            <button className="copy-button" disabled={!markdownPrompt} onClick={copyContext}>
              {copyState === "copied" ? <Check size={16} /> : copyState === "failed" ? <Clipboard size={16} /> : <Copy size={16} />}
              <span>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy context"}</span>
            </button>
          </section>

          <section className="panel-section payload">
            <div className="section-heading">
              <span>Context</span>
            </div>
            <pre>{contextPayload ? JSON.stringify(contextPayload, null, 2) : ""}</pre>
          </section>
        </aside>
      </section>

      {showLogs ? (
        <section className="log-drawer">
          {logs.length === 0 ? (
            <span className="muted">No logs yet.</span>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className={`log-line ${entry.stream}`}>
                <span>{entry.source}</span>
                <code>{entry.message}</code>
              </div>
            ))
          )}
        </section>
      ) : null}
    </main>
  );
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 800;
  }
  return Math.min(Math.max(Math.round(value), 240), 2400);
}

