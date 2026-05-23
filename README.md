# homebridge-cli

`homebridge-cli` is a command-line and MCP interface for the Homebridge UI API. It gives humans and agents a typed command surface for Homebridge status, configuration, plugins, accessories, users, backups, and raw API calls.

The CLI stores profiles in `~/.homebridge/credentials.json`, sends Homebridge bearer tokens only to the configured UI host, and keeps plugin update progress on Homebridge UI's Socket.IO update channel.

## Quick Start

Install the package:

```sh
npm install -g homebridge-cli
```

Log in to your Homebridge UI:

```sh
homebridge auth login \
  --url http://pi.lan:8581 \
  --username admin \
  --password 'your-password'
```

To avoid putting the password in shell history, read it from stdin instead:

```sh
printf '%s' "$HOMEBRIDGE_PASSWORD" | homebridge auth login \
  --url http://pi.lan:8581 \
  --username admin \
  --password-stdin
```

Run a few common checks:

```sh
homebridge auth check
homebridge status homebridge
homebridge server pairing
homebridge plugins outdated
```

Start the MCP server for agent/tooling integrations:

```sh
homebridge --mcp
```

## Functionality

Commands are grouped around Homebridge UI API areas:

- `auth` - login, no-auth token exchange, saved-token setup, token checks, and profile inspection.
- `server` - bridge restart, child bridge control, pairing data, ports, network interfaces, mDNS, cache, and wallpaper commands.
- `config` - config editor operations, plugin config blocks, UI config properties, and config backups.
- `plugins` - installed plugin state, npm search/lookup, versions, schemas, changelogs, releases, aliases, custom UI assets, and plugin updates.
- `accessories` - accessory listing, layout, refresh, and characteristic updates.
- `users` - user CRUD, password changes, and 2FA setup, activation, and deactivation.
- `status` - CPU, RAM, network, uptime, Homebridge status, child bridges, versions, and server information.
- `platform` - Linux host controls, Docker startup/container tools, and hb-service settings/logs.
- `backup` - backup creation/download, scheduled backup management, restore upload, and restore trigger commands.
- `setup` - setup wizard first-user and token commands.
- `api` - raw `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` commands plus Swagger coverage verification.

Use built-in discovery when you need exact options:

```sh
homebridge --help
homebridge plugins --help
homebridge --llms
```

### Plugin Updates

Homebridge UI exposes plugin metadata over REST, but plugin install and update jobs run through its `/plugins` Socket.IO namespace so server progress can stream back to the client.

```sh
homebridge plugins outdated
homebridge plugins update homebridge-unifi-access --version latest
homebridge plugins update-all
```

`plugins outdated` reads `/api/plugins`. `plugins update` and `plugins update-all` connect to the Homebridge plugin socket with the saved bearer token, stream `stdout` and `stderr`, and finish when Homebridge acknowledges the job.

### Raw API Calls

Use `api` commands for endpoints that do not need a dedicated ergonomic wrapper:

```sh
homebridge api get /api/status/homebridge
homebridge api put /api/server/name --body '{"name":"Homebridge"}'
```

## Authentication And Credentials

Credentials are stored at `~/.homebridge/credentials.json` with `0700` directory permissions and `0600` file permissions.

If Homebridge UI auth is disabled, request the no-auth token:

```sh
homebridge auth noauth --url http://pi.lan:8581
```

If you already have a bearer token, save it directly:

```sh
homebridge auth save-token --url http://pi.lan:8581 --token "$HOMEBRIDGE_TOKEN"
```

## Developer

Install dependencies:

```sh
bun install
```

Run the local quality gates:

```sh
bun run build
bun run test
bun run lint
bun run format
```

Verify local Swagger coverage against a Homebridge UI server:

```sh
bun run coverage:live
```

Check the package before publishing:

```sh
bun audit
npm pack --dry-run
npm publish --dry-run --access public
```

The package ships `bin/homebridge.js`, compiled files from `dist/src`, type declarations, docs, changelog, and license. `prepack` runs `bun run build` so published artifacts are regenerated before packing.

### Release Workflow

Releases are automated from `main`.

Before merging to `main`:

- Bump `version` in `package.json`.
- Add a matching `## x.y.z` section in `CHANGELOG.md`.
- Open a pull request targeting `main`; the `Release Check` workflow validates the version, changelog, tests, lint, format, audit, and package dry-run.

When the release commit lands on `main`, the `Release` workflow:

1. Validates that `package.json` has a semver version.
2. Requires a matching changelog section.
3. Fails if that package version is already published on npm.
4. Runs build, tests, lint, format, audit, and `npm pack --dry-run`.
5. Verifies the `NPM_TOKEN` repository secret with `npm whoami`.
6. Creates the `vX.Y.Z` Git tag and GitHub release using the changelog notes.
7. Publishes the package to npm with provenance.

Repository setup required once:

```sh
gh secret set NPM_TOKEN --body '<npm automation token>'
```
