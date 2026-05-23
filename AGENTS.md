# Repository Instructions

This repository publishes `homebridge-cli` to npm from the `main` branch.

## Branches

- `dev` is the working branch.
- `main` is the release branch.
- Open pull requests from `dev` or feature branches into `main` for releases.

## Release Requirements

Every pull request to `main` must be release-ready:

1. Bump `version` in `package.json`.
2. Add a matching `## x.y.z` section to `CHANGELOG.md`.
3. Keep the changelog section non-empty and user-facing.
4. Run the local gates before pushing:

   ```sh
   bun run build
   bun run test
   bun run lint
   bun run format
   bun audit
   npm pack --dry-run
   ```

5. Run `bun run release:validate:local` locally to verify semver and changelog shape.

The GitHub `Release Check` workflow enforces the real release gate on pull requests to `main`, including that the package version is not already published on npm.

## Publishing

Do not publish manually for normal releases. When a release PR is merged to `main`, the `Release` workflow:

1. Validates the version and changelog.
2. Confirms the npm version is unpublished.
3. Runs build, tests, lint, format, audit, and package dry-run.
4. Creates the `vX.Y.Z` Git tag and GitHub release.
5. Publishes to npm using Trusted Publisher OIDC.

npm Trusted Publisher is configured for:

- Owner/repo: `l3wi/homebridge-cli`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`

Trusted Publisher requires npm CLI `11.5.1` or newer in GitHub Actions. Do not remove the workflow step that upgrades npm before publishing.

## Guardrails

- Do not remove or bypass `.github/workflows/release-check.yml`.
- Do not remove or bypass `.github/workflows/release.yml`.
- Do not merge to `main` without a package version bump and changelog entry.
- Do not add npm tokens to the repository; publishing uses OIDC, not `NPM_TOKEN`.
