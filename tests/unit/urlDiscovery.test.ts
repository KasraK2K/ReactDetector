import { describe, expect, it } from "vitest";
import { extractLocalUrls, getDefaultProbeUrls, stripAnsi } from "../../src/core/urlDiscovery.js";

describe("url discovery", () => {
  it("strips ANSI escape sequences", () => {
    expect(stripAnsi("\u001b[32mLocal\u001b[39m")).toBe("Local");
  });

  it("extracts colorized Vite URLs", () => {
    const viteLine = "Local:   \u001b[36mhttp://127.0.0.1:\u001b[1m5181\u001b[22m/\u001b[39m";

    expect(extractLocalUrls(viteLine)).toEqual(["http://127.0.0.1:5181/"]);
  });

  it("probes a wider Vite port range", () => {
    expect(getDefaultProbeUrls("vite-react")).toContain("http://localhost:5181");
  });
});

