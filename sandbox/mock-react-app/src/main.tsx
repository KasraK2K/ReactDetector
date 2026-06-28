import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

type Metric = {
  label: string;
  value: string;
  delta: string;
};

const metrics: Metric[] = [
  { label: "Active agents", value: "18", delta: "+4 today" },
  { label: "Draft dashboards", value: "42", delta: "7 need review" },
  { label: "Healthy data sources", value: "96%", delta: "-2% from last sync" }
];

function App() {
  const [selectedPlan, setSelectedPlan] = useState("Executive summary");
  const [showDrawer, setShowDrawer] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <main className={compactMode ? "app compact" : "app"}>
      <header className="topbar" role="banner">
        <div>
          <p className="eyebrow">Mock workspace</p>
          <h1>AI Dashboard Builder</h1>
        </div>
        <nav aria-label="Primary">
          <a href="#metrics">Metrics</a>
          <a href="#plans">Plans</a>
          <a href="#review">Review</a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Current project</p>
          <h2 id="hero-title">Revenue operations dashboard</h2>
          <p>
            A compact mock app with buttons, forms, sections, cards, and responsive states for testing ReactDetector.
          </p>
        </div>
        <div className="hero-actions">
          <button aria-label="Generate dashboard" onClick={() => setShowDrawer(true)}>
            Generate
          </button>
          <button className="secondary" aria-label="Toggle compact layout" onClick={() => setCompactMode((value) => !value)}>
            {compactMode ? "Comfort" : "Compact"}
          </button>
        </div>
      </section>

      <section id="metrics" className="metric-grid" aria-label="Dashboard metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.delta}</em>
          </article>
        ))}
      </section>

      <section id="plans" className="workspace-grid">
        <aside className="sidebar" aria-label="Dashboard plan list">
          <h2>Plans</h2>
          {["Executive summary", "Sales pipeline", "Retention watch"].map((plan) => (
            <button
              key={plan}
              className={selectedPlan === plan ? "plan-button active" : "plan-button"}
              aria-pressed={selectedPlan === plan}
              onClick={() => setSelectedPlan(plan)}
            >
              {plan}
            </button>
          ))}
        </aside>

        <section className="builder-panel" aria-labelledby="builder-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Selected plan</p>
              <h2 id="builder-heading">{selectedPlan}</h2>
            </div>
            <button aria-label="Open plan details" onClick={() => setShowDrawer(true)}>
              Details
            </button>
          </div>

          <form className="prompt-form" aria-label="Dashboard prompt form">
            <label>
              Prompt
              <textarea defaultValue="Show revenue, pipeline risk, and open follow-ups by owner." />
            </label>
            <div className="form-row">
              <label>
                Audience
                <select defaultValue="leadership">
                  <option value="leadership">Leadership</option>
                  <option value="sales">Sales team</option>
                  <option value="ops">Operations</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                Include data quality warnings
              </label>
            </div>
            <button type="button" className="submit-button" aria-label="Save prompt">
              Save prompt
            </button>
          </form>
        </section>
      </section>

      <section id="review" className="review-section" aria-labelledby="review-heading">
        <div>
          <p className="eyebrow">Review queue</p>
          <h2 id="review-heading">Items needing attention</h2>
        </div>
        <ul>
          <li>
            <button aria-label="Fix mobile chart overflow">Mobile chart overflow</button>
            <span>Only visible under 480px</span>
          </li>
          <li>
            <button aria-label="Fix empty state copy">Empty state copy</button>
            <span>Appears when no CRM rows match filters</span>
          </li>
          <li>
            <button aria-label="Fix export button alignment">Export alignment</button>
            <span>Header action drifts on tablet layout</span>
          </li>
        </ul>
      </section>

      {showDrawer ? (
        <section className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title">
          <div>
            <p className="eyebrow">Component detail</p>
            <h2 id="drawer-title">{selectedPlan}</h2>
            <p>This panel gives ReactDetector a dialog-like surface, close button, and nested text to inspect.</p>
          </div>
          <button aria-label="Close details" onClick={() => setShowDrawer(false)}>
            Close
          </button>
        </section>
      ) : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

