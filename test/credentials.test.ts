import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  credentialsPath,
  getProfile,
  saveProfile,
} from "../src/credentials.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
  tempDirs.length = 0;
});

describe("credentials", () => {
  it("stores profiles in ~/.homebridge/credentials.json shape", async () => {
    const home = await mkdtemp(join(tmpdir(), "homebridge-cli-"));
    tempDirs.push(home);
    const path = credentialsPath(home);

    await saveProfile(
      {
        token: "secret-token",
        url: "http://pi.lan:8581",
        username: "admin",
        savedAt: "2026-05-23T00:00:00.000Z",
      },
      { path },
    );

    await expect(getProfile({ path })).resolves.toMatchObject({
      token: "secret-token",
      url: "http://pi.lan:8581",
      username: "admin",
    });
    await expect(
      readFile(path, "utf8").then(JSON.parse),
    ).resolves.toMatchObject({
      defaultProfile: "default",
      profiles: {
        default: {
          token: "secret-token",
        },
      },
    });
  });
});
