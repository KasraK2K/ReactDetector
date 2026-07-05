import { test, expect } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { injectInspectorScript } from "../../src/server/htmlRewrite.js";

let server: http.Server;
let baseUrl: string;

test.beforeAll(async () => {
  const inspectorPath = path.resolve("dist/inspector/inspector.js");
  const inspectorScript = fs.readFileSync(inspectorPath, "utf8");

  server = http.createServer((req, res) => {
    if (req.url === "/__rd/inspector.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(inspectorScript);
      return;
    }

    if (req.url === "/target") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        injectInspectorScript(`
          <!doctype html>
          <html>
            <body>
              <main>
                <h1>Checkout</h1>
                <section>
                  <h2>Order summary</h2>
                  <p>Review the selected plan before payment.</p>
                </section>
                <button aria-label="Pay now">Pay</button>
                <a href="#details">Details</a>
              </main>
            </body>
          </html>
        `)
      );
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end(`
      <!doctype html>
      <html>
        <body>
          <iframe src="/target"></iframe>
          <script>
            window.addEventListener("message", (event) => {
              window.__lastSelection = event.data;
            });
          </script>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("posts selected element context from the injected inspector", async ({ page }) => {
  await page.goto(baseUrl);
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "Pay now" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __lastSelection?: unknown }).__lastSelection))
    .toBeUndefined();

  await page.locator("iframe").evaluate((node) => {
    const iframe = node as HTMLIFrameElement;
    iframe.contentWindow?.postMessage(
      {
        source: "reactdetector",
        type: "rd:selection-mode",
        enabled: true
      },
      "*"
    );
  });
  await frame.getByRole("heading", { name: "Order summary" }).hover();
  await expect(frame.locator('[data-reactdetector-hover-box="true"]')).toHaveCSS("opacity", "1");
  await expect(frame.locator('[data-reactdetector-hover-label="true"]')).toContainText("Select: h2 - Order summary");
  await expect(frame.getByRole("heading", { name: "Order summary" })).toHaveAttribute("data-reactdetector-hover-target", "true");

  await frame.getByRole("heading", { name: "Order summary" }).click();

  const payload = await page
    .waitForFunction(() => (window as unknown as { __lastSelection?: { payload: unknown } }).__lastSelection?.payload)
    .then((handle) => handle.jsonValue());

  expect(payload).toMatchObject({
    accessibleName: "Order summary",
    tag: "h2"
  });
  expect((payload as { classification: string[] }).classification).toContain("element");
  await expect(frame.getByRole("heading", { name: "Order summary" })).toHaveAttribute("data-reactdetector-selected-target", "true");
  await expect(frame.getByRole("heading", { name: "Order summary" })).not.toHaveAttribute("data-reactdetector-hover-target", "true");
  await expect(frame.locator('[data-reactdetector-selected-box="true"]')).toHaveCSS("opacity", "1");
  await expect(frame.locator('[data-reactdetector-selected-label="true"]')).toContainText("Selected:");
  await frame.getByRole("link", { name: "Details" }).click();
  await expect(frame.locator("body")).toHaveJSProperty("baseURI", `${baseUrl}/target#details`);
});
