import { describe, expect, it } from "vitest";
import {
  compareSwaggerCoverage,
  extractSwaggerOperations,
} from "../src/swagger.js";

describe("swagger coverage", () => {
  it("extracts method/path operations from a Swagger document", () => {
    const operations = extractSwaggerOperations({
      paths: {
        "/api/auth/check": {
          get: {
            operationId: "AuthController_checkAuth",
            summary: "Check auth",
            tags: ["Authentication"],
          },
        },
        "/api/status/homebridge": {
          get: {
            operationId: "StatusController_checkHomebridgeStatus",
            tags: ["Server Status"],
          },
        },
      },
    });

    expect(operations).toEqual([
      {
        method: "GET",
        operationId: "AuthController_checkAuth",
        path: "/api/auth/check",
        summary: "Check auth",
        tags: ["Authentication"],
      },
      {
        method: "GET",
        operationId: "StatusController_checkHomebridgeStatus",
        path: "/api/status/homebridge",
        summary: undefined,
        tags: ["Server Status"],
      },
    ]);
  });

  it("compares live Swagger operations against CLI operations while excluding manual auth commands", () => {
    const coverage = compareSwaggerCoverage([
      { method: "GET", path: "/api/auth/check", tags: [] },
      { method: "GET", path: "/api/status/homebridge", tags: [] },
    ]);

    expect(coverage.missing).toEqual([]);
    expect(coverage.extra).toContain("GET /api/status/cpu");
  });
});
