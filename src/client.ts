import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getProfile, type HomebridgeProfile } from "./credentials.js";

export type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export type HomebridgeClientOptions = {
  fetch?: typeof fetch;
  profile?: HomebridgeProfile;
  profileName?: string;
  credentialsPath?: string;
};

export type RequestOptions = {
  authenticated?: boolean;
  body?: unknown;
  file?: string;
  headers?: Record<string, string>;
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown>;
};

export class HomebridgeApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(status: number, body: unknown) {
    super(
      `Homebridge API request failed with HTTP ${status}${formatErrorBody(body)}`,
    );
    this.name = "HomebridgeApiError";
    this.status = status;
    this.body = body;
  }
}

function formatErrorBody(body: unknown): string {
  if (!body) return "";
  if (typeof body === "string") return `: ${body}`;
  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return `: ${record.message}`;
    if (Array.isArray(record.message)) return `: ${record.message.join(", ")}`;
    if (typeof record.error === "string") return `: ${record.error}`;
  }
  return "";
}

export async function createClient(
  options: HomebridgeClientOptions = {},
): Promise<HomebridgeClient> {
  const profile =
    options.profile ??
    (await getProfile({
      name: options.profileName,
      path: options.credentialsPath,
    }));
  if (!profile) {
    throw new Error(
      "Not logged in. Run `homebridge auth login --url <url> --username <user> --password <pass>`.",
    );
  }
  return new HomebridgeClient(profile, options.fetch ?? fetch);
}

export class HomebridgeClient {
  constructor(
    private readonly profile: HomebridgeProfile,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request(options: RequestOptions): Promise<unknown> {
    const url = new URL(options.path, normalizeBaseUrl(this.profile.url));
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers(options.headers);
    if (options.authenticated !== false)
      headers.set("Authorization", `Bearer ${this.profile.token}`);

    let body: BodyInit | undefined;
    if (options.file) {
      const form = new FormData();
      form.set(
        "file",
        new Blob([await readFile(options.file)]),
        basename(options.file),
      );
      body = form;
    } else if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await this.fetcher(url, {
      body,
      headers,
      method: options.method,
    });
    const responseBody = await parseResponse(response);
    if (!response.ok)
      throw new HomebridgeApiError(response.status, responseBody);
    return responseBody;
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export async function login(options: {
  fetch?: typeof fetch;
  otp?: string;
  password: string;
  url: string;
  username: string;
}): Promise<{ token: string; response: unknown }> {
  const response = await (options.fetch ?? fetch)(
    new URL("/api/auth/login", normalizeBaseUrl(options.url)),
    {
      body: JSON.stringify({
        username: options.username,
        password: options.password,
        otp: options.otp,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const body = await parseResponse(response);
  if (!response.ok) throw new HomebridgeApiError(response.status, body);
  const token = extractToken(body);
  if (!token)
    throw new Error("Login succeeded but no token was found in the response.");
  return { token, response: body };
}

export function extractToken(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  for (const key of ["access_token", "accessToken", "token", "jwt"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return undefined;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
