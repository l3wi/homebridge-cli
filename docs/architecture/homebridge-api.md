# Homebridge API Notes

The Homebridge UI exposes its REST API through the local UI server at `/swagger` and `/swagger-json`.

For the local target used during development, `http://pi.lan:8581/swagger-json` reports:

- OpenAPI: `3.0.0`
- API title: `Homebridge UI API Reference`
- API version: `5.3.0`
- Swagger operations: `101`

Authentication is bearer-token based. The Swagger security scheme uses password OAuth flow metadata with token URL `/api/auth/login`; the practical login request is `POST /api/auth/login` with `username`, `password`, and optional `otp`.

The CLI handles the four authentication endpoints manually:

- `POST /api/auth/login`
- `GET /api/auth/settings`
- `POST /api/auth/noauth`
- `GET /api/auth/check`

The remaining `97` operations are represented in `src/operations.ts` and mounted as grouped commands. `homebridge api coverage` fetches `/swagger-json` and compares method/path identity against the local operation table, excluding the auth endpoints above.

Command groups follow the Swagger tags:

- Authentication -> `auth`
- Homebridge -> `server`
- Homebridge Config Editor -> `config`
- Plugins -> `plugins`
- Accessories -> `accessories`
- User Management -> `users`
- Server Status -> `status`
- Platform - Linux, Docker, HB Service -> `platform`
- Backup & Restore -> `backup`
- Setup Wizard -> `setup`

The Swagger document has incomplete request-body details for some endpoints, so generated operation commands expose generic `--body`, `--query`, and `--file` options. Specialized ergonomic commands can be layered on top without removing the raw operation coverage.

## Plugin Update Channel

Plugin read operations are in Swagger under `/api/plugins`, including installed plugin state and npm metadata. Homebridge UI does not expose plugin install, uninstall, or update jobs as Swagger REST operations in UI `5.3.0`.

Those mutating plugin jobs use the Socket.IO namespace `/plugins` with the bearer token passed as the socket query token. The CLI keeps plugin discovery on REST and uses Socket.IO only for job commands:

- `plugins outdated` calls `GET /api/plugins` and filters `updateAvailable`.
- `plugins update <pluginName>` emits `update` to `/plugins` with `name`, `version`, `termCols`, and `termRows`.
- `plugins update-all` reads outdated plugins over REST, then emits one `update` job per plugin.

The socket streams `stdout` and `stderr` events while the job runs and reports completion through the Homebridge acknowledgement callback.
