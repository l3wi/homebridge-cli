#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const skipRegistry = process.argv.includes("--skip-registry");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const version = packageJson.version;
const packageName = packageJson.name;
const expectedRepositoryUrl = "git+https://github.com/l3wi/homebridge-cli.git";

if (!packageName || typeof packageName !== "string") {
  fail("package.json must define a package name.");
}

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(
    `package.json version must be a valid semver version. Found: ${version}`,
  );
}

const changelogHeading = new RegExp(
  `^##\\s+(?:\\[)?${escapeRegExp(version)}(?:\\])?(?:\\s|$)`,
  "m",
);

if (!changelogHeading.test(changelog)) {
  fail(`CHANGELOG.md must include a release section for ${version}.`);
}

assertRepositoryMetadata(packageJson, expectedRepositoryUrl);
await assertReleaseTagIsAvailable(version);

if (!skipRegistry) {
  await assertVersionIsUnpublished(packageName, version);
}

console.log(`Release validation passed for ${packageName}@${version}.`);

async function assertVersionIsUnpublished(packageName, version) {
  try {
    await execFileAsync("npm", [
      "view",
      `${packageName}@${version}`,
      "version",
      "--registry=https://registry.npmjs.org/",
    ]);
  } catch (error) {
    if (error && typeof error === "object" && error.code === 1) {
      const stderr = String(error.stderr ?? "");
      if (stderr.includes("E404")) return;
    }
    throw error;
  }

  fail(
    `${packageName}@${version} is already published. Bump package.json first.`,
  );
}

async function assertReleaseTagIsAvailable(version) {
  const tag = `v${version}`;

  try {
    const { stdout } = await execFileAsync("git", [
      "ls-remote",
      "--tags",
      "origin",
      tag,
    ]);
    if (stdout.trim()) {
      fail(`Git tag ${tag} already exists on origin. Bump package.json first.`);
    }
  } catch (error) {
    const localTagExists = await hasLocalTag(tag);
    if (localTagExists) {
      fail(`Git tag ${tag} already exists locally. Bump package.json first.`);
    }
    if (error && typeof error === "object") {
      const stderr = String(error.stderr ?? "");
      if (stderr.includes("No remote configured")) return;
    }
    throw error;
  }
}

function assertRepositoryMetadata(packageJson, expectedUrl) {
  const repository =
    typeof packageJson.repository === "string"
      ? { url: packageJson.repository }
      : packageJson.repository;

  if (!repository || repository.url !== expectedUrl) {
    fail(
      `package.json repository.url must be ${expectedUrl} for npm provenance.`,
    );
  }
}

async function hasLocalTag(tag) {
  try {
    await execFileAsync("git", ["rev-parse", "--verify", "--quiet", tag]);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
