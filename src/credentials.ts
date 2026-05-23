import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Credentials = {
  defaultProfile: string;
  profiles: Record<string, HomebridgeProfile>;
};

export type HomebridgeProfile = {
  token: string;
  url: string;
  username?: string;
  savedAt: string;
};

const defaultProfile = "default";

export function credentialsPath(home = homedir()): string {
  return join(home, ".homebridge", "credentials.json");
}

export async function readCredentials(
  path = credentialsPath(),
): Promise<Credentials | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Credentials;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeCredentials(
  credentials: Credentials,
  path = credentialsPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export async function saveProfile(
  profile: HomebridgeProfile,
  options: { name?: string; path?: string } = {},
): Promise<Credentials> {
  const name = options.name ?? defaultProfile;
  const existing = await readCredentials(options.path);
  const next = {
    defaultProfile: existing?.defaultProfile ?? name,
    profiles: {
      ...(existing?.profiles ?? {}),
      [name]: profile,
    },
  };
  await writeCredentials(next, options.path);
  return next;
}

export async function getProfile(
  options: { name?: string; path?: string } = {},
): Promise<HomebridgeProfile | undefined> {
  const credentials = await readCredentials(options.path);
  if (!credentials) return undefined;
  const name = options.name ?? credentials.defaultProfile;
  return credentials.profiles[name];
}
