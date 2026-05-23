# homebridge-cli

An `incur` powered CLI and MCP interface for the Homebridge UI API.

The CLI stores connection credentials in `~/.homebridge/credentials.json` and maps the Homebridge Swagger surface into grouped commands for agents and humans.

```sh
homebridge auth login --url http://pi.lan:8581 --username admin --password '...'
homebridge status homebridge
homebridge server pairing
homebridge plugins list
homebridge plugins outdated
homebridge plugins update-all
homebridge api get /api/status/homebridge
homebridge --mcp
```

## Commands

Commands are grouped around the Homebridge UI Swagger tags:

- `auth` - login, no-auth token exchange, token checks, profile inspection.
- `server` - bridge restart, child bridge control, pairing, ports, network interfaces, mDNS, cache, wallpaper.
- `config` - config editor, plugin config blocks, UI config properties, config backups.
- `plugins` - installed plugins, npm lookup/search, schemas, changelogs, releases, aliases, custom UI assets.
- `accessories` - accessory listing, layout, refresh, and characteristic updates.
- `users` - user CRUD, password changes, and 2FA setup/activation/deactivation.
- `status` - CPU, RAM, network, uptime, Homebridge, child bridges, versions, server info.
- `platform` - Linux host controls, Docker startup/container tools, hb-service settings/logs.
- `backup` - backup creation/download, scheduled backup management, restore upload/trigger.
- `setup` - setup wizard first-user and token commands.
- `api` - raw `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, plus Swagger coverage verification.

Run `homebridge --help`, `homebridge <group> --help`, or `homebridge --llms` for command discovery.

## Plugin Updates

Homebridge UI exposes plugin metadata over REST, but plugin install/update jobs run through its `/plugins` Socket.IO namespace so progress can stream back from the server.

```sh
homebridge plugins outdated
homebridge plugins update homebridge-unifi-access --version latest
homebridge plugins update-all
```

`plugins update` and `plugins update-all` use the saved bearer token as the Socket.IO query token, then stream `stdout` and `stderr` events until Homebridge acknowledges the update job.

## Authentication

Login with a password argument:

```sh
homebridge auth login --url http://pi.lan:8581 --username admin --password '...'
```

Or avoid putting the password in shell history:

```sh
printf '%s' "$HOMEBRIDGE_PASSWORD" | homebridge auth login --url http://pi.lan:8581 --username admin --password-stdin
```

If Homebridge UI auth is disabled, request the no-auth token:

```sh
homebridge auth noauth --url http://pi.lan:8581
```

Credentials are stored at `~/.homebridge/credentials.json` with `0700` directory and `0600` file permissions.

## Coverage

Verify the current grouped command map against the live Homebridge Swagger document:

```sh
homebridge api coverage --no-auth --url http://pi.lan:8581
```

The expected local Homebridge UI API currently reports `101` Swagger operations: `4` auth operations handled by the `auth` group, plus `97` grouped API operations.

## Development

```sh
bun install
bun run build
bun run test
bun run lint
bun run format
bun run coverage:live
```
