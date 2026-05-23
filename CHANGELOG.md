# Changelog

## 0.1.3

- Added npm provenance-compatible repository metadata to `package.json`.
- Added release validation for repository metadata required by npm Trusted Publisher provenance.
- Bumped the pending release after the failed `0.1.2` publish created `v0.1.2`.

## 0.1.2

- Added release validation for existing Git tags so release PRs fail before merging if their target tag has already been created.
- Fixed release workflow tag comparison to avoid false positives when the target tag does not exist.
- Bumped the pending release after the failed `0.1.1` publish created `v0.1.1`.

## 0.1.1

- Added GitHub Actions release checks and main-branch npm publish automation.
- Added npm Trusted Publisher release support through GitHub OIDC.
- Updated the release workflow to install a Trusted Publisher-compatible npm CLI.
- Added repository agent instructions for release PRs, changelog updates, and publish guardrails.

## 0.1.0

- Scaffolded an `incur` based Homebridge CLI/MCP binary.
- Added credential profile storage in `~/.homebridge/credentials.json`.
- Added grouped commands for the Homebridge UI Swagger API surface.
- Added raw API request commands and live Swagger coverage verification.
- Added REST-backed `plugins outdated` plus Socket.IO-backed `plugins update` and `plugins update-all` commands for Homebridge plugin jobs.
- Added publish metadata, importable package exports, license text, and npm-ready README documentation.
- Added tests for credentials, client request behavior, operation metadata, and Swagger coverage helpers.
