export function parseJsonObject(
  input: string | undefined,
  label: string,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const value = JSON.parse(input) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function parseJsonValue(input: string | undefined): unknown {
  if (input === undefined) return undefined;
  return JSON.parse(input) as unknown;
}
