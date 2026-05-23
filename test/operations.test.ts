import { describe, expect, it } from "vitest";
import { fillPath, operations, pathParameterNames } from "../src/operations.js";

describe("operations", () => {
  it("covers the non-auth Homebridge Swagger operation count captured from pi.lan", () => {
    expect(operations).toHaveLength(97);
  });

  it("keeps operation commands unique within each group", () => {
    const seen = new Set<string>();
    for (const operation of operations) {
      const key = `${operation.group}:${operation.command}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("extracts and fills OpenAPI path parameters", () => {
    expect(pathParameterNames("/api/server/restart/{deviceId}")).toEqual([
      "deviceId",
    ]);
    expect(
      fillPath("/api/plugins/settings-ui/{pluginName}/{path}", {
        path: "index.html",
        pluginName: "homebridge-hue",
      }),
    ).toBe("/api/plugins/settings-ui/homebridge-hue/index.html");
  });
});
