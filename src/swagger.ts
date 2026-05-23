import { operations, type ApiOperation } from "./operations.js";

export type SwaggerOperation = {
  method: string;
  operationId?: string;
  path: string;
  summary?: string;
  tags: string[];
};

export type SwaggerCoverage = {
  authOperations: number;
  cliOperations: number;
  extra: string[];
  liveOperations: number;
  missing: string[];
};

const authOperationKeys = new Set([
  "GET /api/auth/check",
  "GET /api/auth/settings",
  "POST /api/auth/login",
  "POST /api/auth/noauth",
]);

export function extractSwaggerOperations(spec: unknown): SwaggerOperation[] {
  if (!spec || typeof spec !== "object") {
    throw new Error("Swagger document must be an object.");
  }
  const paths = (spec as { paths?: unknown }).paths;
  if (!paths || typeof paths !== "object") {
    throw new Error("Swagger document is missing a paths object.");
  }

  const extracted: SwaggerOperation[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") continue;
    for (const [method, value] of Object.entries(methods)) {
      if (!value || typeof value !== "object") continue;
      const operation = value as {
        operationId?: unknown;
        summary?: unknown;
        tags?: unknown;
      };
      extracted.push({
        method: method.toUpperCase(),
        operationId:
          typeof operation.operationId === "string"
            ? operation.operationId
            : undefined,
        path,
        summary:
          typeof operation.summary === "string" ? operation.summary : undefined,
        tags: Array.isArray(operation.tags)
          ? operation.tags.filter(
              (tag): tag is string => typeof tag === "string",
            )
          : [],
      });
    }
  }
  return extracted.sort((left, right) =>
    `${left.method} ${left.path}`.localeCompare(
      `${right.method} ${right.path}`,
    ),
  );
}

export function compareSwaggerCoverage(
  swaggerOperations: SwaggerOperation[],
  cliOperations: readonly ApiOperation[] = operations,
): SwaggerCoverage {
  const liveKeys = swaggerOperations.map(operationKey);
  const cliKeys = cliOperations.map(operationKey);
  return {
    authOperations: authOperationKeys.size,
    cliOperations: cliKeys.length,
    extra: cliKeys.filter((key) => !liveKeys.includes(key)),
    liveOperations: liveKeys.length,
    missing: liveKeys.filter(
      (key) => !authOperationKeys.has(key) && !cliKeys.includes(key),
    ),
  };
}

export async function fetchSwaggerOperations(
  url: string,
  options: { fetch?: typeof fetch; token?: string } = {},
): Promise<SwaggerOperation[]> {
  const headers = new Headers();
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const response = await (options.fetch ?? fetch)(
    new URL("/swagger-json", normalizeSwaggerBaseUrl(url)),
    { headers },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Swagger JSON: HTTP ${response.status}`);
  }
  return extractSwaggerOperations(await response.json());
}

function operationKey(operation: { method: string; path: string }): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

function normalizeSwaggerBaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
