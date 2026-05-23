# Changelog

## 0.1.0

- Scaffolded an `incur` based Homebridge CLI/MCP binary.
- Added credential profile storage in `~/.homebridge/credentials.json`.
- Added grouped commands for the Homebridge UI Swagger API surface.
- Added raw API request commands and live Swagger coverage verification.
- Added REST-backed `plugins outdated` plus Socket.IO-backed `plugins update` and `plugins update-all` commands for Homebridge plugin jobs.
- Added tests for credentials, client request behavior, operation metadata, and Swagger coverage helpers.
