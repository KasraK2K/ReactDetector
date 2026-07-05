import { describe, expect, it } from "vitest";
import {
  assignRuntimeIds,
  buildSelector,
  classifyElement,
  createSelectedElementPayload,
  findSelectableElement,
  getAccessibleName,
  getNearbyContext
} from "../../src/inspector/dom-utils.js";

describe("dom utils", () => {
  it("classifies common controls and sections", () => {
    document.body.innerHTML = `
      <main>
        <section class="billing-card">
          <h2>Billing</h2>
          <button aria-label="Save billing">Save</button>
        </section>
      </main>
    `;

    const button = document.querySelector("button")!;
    const section = document.querySelector("section")!;

    expect(classifyElement(button)).toContain("button");
    expect(classifyElement(section)).toEqual(expect.arrayContaining(["section", "card"]));
  });

  it("finds the interactive parent from nested content", () => {
    document.body.innerHTML = `<button id="save"><span><strong>Save</strong></span></button>`;
    const strong = document.querySelector("strong")!;

    expect(findSelectableElement(strong)).toBe(document.querySelector("button"));
  });

  it("selects non-interactive elements directly", () => {
    document.body.innerHTML = `
      <section>
        <h2>Revenue summary</h2>
        <p>Quarterly performance text</p>
      </section>
    `;
    const heading = document.querySelector("h2")!;
    const paragraph = document.querySelector("p")!;

    expect(findSelectableElement(heading)).toBe(heading);
    expect(findSelectableElement(paragraph)).toBe(paragraph);
  });

  it("builds stable selectors from test attributes", () => {
    document.body.innerHTML = `<button data-testid="save-button">Save</button>`;
    const button = document.querySelector("button")!;

    expect(buildSelector(button)).toBe('button[data-testid="save-button"]');
  });

  it("extracts accessible labels", () => {
    document.body.innerHTML = `<label for="email">Email address</label><input id="email" />`;
    const input = document.querySelector("input")!;

    expect(getAccessibleName(input)).toBe("Email address");
  });

  it("creates the selected element payload", () => {
    document.body.innerHTML = `
      <main>
        <h1>Settings</h1>
        <button class="primary" aria-label="Save settings">Save</button>
      </main>
    `;
    assignRuntimeIds();
    const button = document.querySelector("button")!;

    const payload = createSelectedElementPayload(button);

    expect(payload.rdId).toMatch(/^rd_/);
    expect(payload.accessibleName).toBe("Save settings");
    expect(payload.classification).toContain("button");
    expect(payload.nearby.headings).toContain("Settings");
    expect(payload.react.confidence).toBe("unavailable");
  });

  it("keeps nearby landmarks short and useful", () => {
    document.body.innerHTML = `
      <main>
        <h1>Mock workspace AI Dashboard Builder</h1>
        <section aria-labelledby="hero-title">
          <h2 id="hero-title">Revenue operations dashboard</h2>
          <article>
            <span>Healthy data sources</span>
            <strong>96%</strong>
          </article>
        </section>
        <section>
          ${Array.from({ length: 30 }, (_value, index) => `<p>Extra page text ${index}</p>`).join("")}
        </section>
      </main>
    `;

    const article = document.querySelector("article")!;
    const context = getNearbyContext(article);

    expect(context.headings).toContain("Revenue operations dashboard");
    expect(context.landmarks).toContain("region: Revenue operations dashboard");
    expect(context.landmarks.some((label) => label.startsWith("main:"))).toBe(false);
    expect(context.landmarks.every((label) => label.length <= 96)).toBe(true);
  });
});
