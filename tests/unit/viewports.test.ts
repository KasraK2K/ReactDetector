import { describe, expect, it } from "vitest";
import { parseViewportIds, serializeIssueViewportScope } from "../../src/shared/viewports.js";

describe("viewports", () => {
  it("parses known viewport ids", () => {
    expect(parseViewportIds("mobile,desktop,unknown")).toEqual(["mobile", "desktop"]);
  });

  it("serializes unspecified scope", () => {
    expect(serializeIssueViewportScope([], false)).toEqual({
      mode: "unspecified",
      viewports: []
    });
  });

  it("serializes all scope", () => {
    expect(serializeIssueViewportScope([], true)).toEqual({
      mode: "all",
      viewports: ["mobile", "tablet", "laptop", "desktop"]
    });
  });

  it("serializes specific scope", () => {
    expect(serializeIssueViewportScope(["mobile", "tablet"], false)).toEqual({
      mode: "specific",
      viewports: ["mobile", "tablet"]
    });
  });
});

