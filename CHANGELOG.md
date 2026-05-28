# Changelog

All notable changes to this project will be documented in this file.

---

## Unreleased

### Changed

- Extracted shared DB layer to `packages/db` (`@workspace/db`): ArchiMate model types, Drizzle schema, SQLite connection, migrations, and model I/O now live in one package consumed by both `apps/api` and `apps/mcp-server`.
- `apps/mcp-server` now depends on `api` workspace package directly (replaces manual `mcp-archimate` symlink).
- Migration files moved from `apps/api/drizzle/` to `packages/db/drizzle/` — run `cd packages/db && npx drizzle-kit generate` after schema changes.
- MCP server endpoint corrected to `http://localhost:3001/mcp/` (was documented as `:3000`).

---
