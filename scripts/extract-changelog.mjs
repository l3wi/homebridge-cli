#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const version = packageJson.version;
const heading = new RegExp(
  `^##\\s+(?:\\[)?${escapeRegExp(version)}(?:\\])?(?:\\s.*)?$`,
  "m",
);
const match = heading.exec(changelog);

if (!match) {
  console.error(
    `CHANGELOG.md does not include a release section for ${version}.`,
  );
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = changelog.slice(start);
const nextHeading = rest.search(/^##\s+/m);
const notes = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();

if (!notes) {
  console.error(`CHANGELOG.md release section for ${version} is empty.`);
  process.exit(1);
}

console.log(notes);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
