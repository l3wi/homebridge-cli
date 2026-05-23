import { describe, expect, it, vi } from "vitest";
import {
  HomebridgeApiError,
  HomebridgeClient,
  extractToken,
  login,
} from "../src/client.js";

describe("HomebridgeClient", () => {
  it("normalizes base URL, adds bearer auth, query params, and JSON bodies", async () => {
    const fetcher = vi.fn(
      async (
        _input: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return Response.json({ ok: true });
      },
    );
    const client = new HomebridgeClient(
      {
        token: "token-1",
        url: "http://pi.lan:8581",
        savedAt: "2026-05-23T00:00:00.000Z",
      },
      fetcher as unknown as typeof fetch,
    );

    await client.request({
      body: { name: "Bridge" },
      method: "PUT",
      path: "/api/server/name",
      query: { dryRun: true },
    });

    expect(String(fetcher.mock.calls[0][0])).toBe(
      "http://pi.lan:8581/api/server/name?dryRun=true",
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe(
      "Bearer token-1",
    );
    expect(init.body).toBe(JSON.stringify({ name: "Bridge" }));
  });

  it("includes API error messages in thrown errors", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => {
      return Response.json({ message: "bad token" }, { status: 401 });
    });
    const client = new HomebridgeClient(
      {
        token: "token-1",
        url: "http://pi.lan:8581",
        savedAt: "2026-05-23T00:00:00.000Z",
      },
      fetcher as unknown as typeof fetch,
    );

    await expect(
      client.request({ method: "GET", path: "/api/auth/check" }),
    ).rejects.toThrow("Homebridge API request failed with HTTP 401: bad token");
    await expect(
      client.request({ method: "GET", path: "/api/auth/check" }),
    ).rejects.toBeInstanceOf(HomebridgeApiError);
  });
});

describe("login", () => {
  it("extracts supported token response fields", () => {
    expect(extractToken({ access_token: "a" })).toBe("a");
    expect(extractToken({ accessToken: "b" })).toBe("b");
    expect(extractToken({ token: "c" })).toBe("c");
  });

  it("posts username, password, and otp to /api/auth/login", async () => {
    const fetcher = vi.fn(
      async (
        _input: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return Response.json({ access_token: "jwt" });
      },
    );

    await expect(
      login({
        fetch: fetcher as unknown as typeof fetch,
        otp: "123456",
        password: "pass",
        url: "http://pi.lan:8581",
        username: "admin",
      }),
    ).resolves.toMatchObject({ token: "jwt" });

    expect(String(fetcher.mock.calls[0][0])).toBe(
      "http://pi.lan:8581/api/auth/login",
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      username: "admin",
      password: "pass",
      otp: "123456",
    });
  });
});
