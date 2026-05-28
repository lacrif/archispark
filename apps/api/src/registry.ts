/**
 * Multi-workspace registry backed by SQLite (Drizzle ORM).
 *
 * Architecture:
 *   - Workspaces listed in the `workspaces` DB table (replaces workspaces.json).
 *   - Each workspace stores its ArchiMate model in normalized tables.
 *   - At runtime the active workspace model is held in-memory (DataSource).
 *   - `saveDataSource(ds)` flushes the in-memory model back to DB.
 *   - `activateWorkspace(id)` switches the active workspace and loads its model.
 *   - The exported `dataSource` is a live ESM binding — all importers see the
 *     new value after activateWorkspace() without any route changes.
 *
 * Startup (called from main.ts):
 *   1. runMigrations() — idempotently applies pending SQL migrations.
 *   2. initRegistry() — seeds workspaces.json / XML files if DB is empty,
 *      then loads the first workspace into memory.
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db, runMigrations, workspaces as wsTable, modelFromDb, modelToDb, seedWorkspace } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { initUsers } from "./auth.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string;       // numeric id as string for URL params
  name: string;
  active: boolean;
}

export interface DataSource {
  readonly workspaceDbId: number;
  readonly path: string;           // kept for backward compat (empty for DB-backed workspaces)
  readonly model: import("./model.js").ArchiModel;
  elementTypes: string[];
  relationshipTypes: string[];
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let _activeId: number;
const _loaded = new Map<number, DataSource>();

// Live ESM binding — reassigned by activateWorkspace()
export let dataSource: DataSource;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildRuntimeDs(dbId: number): DataSource {
  const model = modelFromDb(dbId);
  return {
    workspaceDbId: dbId,
    path: "",
    model,
    elementTypes: [...new Set(model.elements.map((e) => e.type).filter(Boolean))].sort(),
    relationshipTypes: [...new Set(model.relationships.map((r) => r.type).filter(Boolean))].sort(),
  };
}

function dbIdToStrId(id: number): string {
  return String(id);
}

function strIdToDbId(id: string): number {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid workspace id '${id}'`);
  return n;
}

// ---------------------------------------------------------------------------
// Auto-init at module load time
// (runs migrations + seeds from legacy files if DB is empty)
// ---------------------------------------------------------------------------

function _init(): void {
  runMigrations();
  initUsers();

  const count = db.select({ id: wsTable.id }).from(wsTable).all().length;
  if (count === 0) {
    _seedFromLegacy();
    const afterSeed = db.select({ id: wsTable.id }).from(wsTable).all().length;
    if (afterSeed === 0) {
      seedWorkspace("Default", { uuid: randomUUID(), name: "Default", desc: null, version: null, elements: [], relationships: [], propertyDefinitions: [], views: [] });
    }
  }

  const rows = db.select({ id: wsTable.id }).from(wsTable).all();
  if (rows.length === 0) throw new Error("No workspaces in DB after init");

  _activeId = rows[0]!.id;
  const ds = buildRuntimeDs(_activeId);
  _loaded.set(_activeId, ds);
  dataSource = ds;
}

_init();

function _seedFromLegacy(): void {
  const wsFile = join(process.cwd(), "workspaces.json");
  const cfgFile = join(process.cwd(), "config.json");

  if (existsSync(wsFile)) {
    const entries = JSON.parse(readFileSync(wsFile, "utf-8")) as Array<{ id: string; name: string; path: string }>;
    for (const entry of entries) {
      const xmlPath = join(process.cwd(), entry.path);
      if (existsSync(xmlPath)) {
        const xml = readFileSync(xmlPath, "utf-8");
        const model = parseOpenExchange(xml);
        seedWorkspace(entry.name, model);
      }
    }
  } else if (existsSync(cfgFile)) {
    const cfg = JSON.parse(readFileSync(cfgFile, "utf-8")) as { path: string; name: string };
    const xmlPath = join(process.cwd(), cfg.path);
    if (existsSync(xmlPath)) {
      const xml = readFileSync(xmlPath, "utf-8");
      const model = parseOpenExchange(xml);
      seedWorkspace(cfg.name, model);
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getWorkspaces(): WorkspaceOut[] {
  return db.select().from(wsTable).all().map((r) => ({
    id: dbIdToStrId(r.id),
    name: r.name,
    active: r.id === _activeId,
  }));
}

export function getActiveWorkspaceId(): string {
  return dbIdToStrId(_activeId);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function activateWorkspace(id: string): WorkspaceOut {
  const dbId = strIdToDbId(id);
  const row = db.select().from(wsTable).where(eq(wsTable.id, dbId)).get();
  if (!row) throw new Error(`Workspace '${id}' introuvable.`);
  if (!_loaded.has(dbId)) {
    _loaded.set(dbId, buildRuntimeDs(dbId));
  }
  _activeId = dbId;
  dataSource = _loaded.get(dbId)!;
  return { id, name: row.name, active: true };
}

export function createWorkspace(name: string, xmlFilePath?: string): WorkspaceOut {
  if (!name?.trim()) throw new Error("Le nom du workspace est requis.");
  const existing = db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name)).get();
  if (existing) throw new Error(`Un workspace nommé '${name}' existe déjà.`);

  let model: import("./model.js").ArchiModel;

  if (xmlFilePath) {
    const fullPath = join(process.cwd(), xmlFilePath);
    if (!existsSync(fullPath)) throw new Error(`Fichier XML introuvable: ${xmlFilePath}`);
    const xml = readFileSync(fullPath, "utf-8");
    model = parseOpenExchange(xml);
  } else {
    // Empty model
    model = {
      uuid: `id-${randomUUID()}`,
      name: name.trim(),
      desc: null,
      version: null,
      elements: [],
      relationships: [],
      propertyDefinitions: [],
      views: [],
    };
  }

  const dbId = seedWorkspace(name.trim(), model);
  const ds = buildRuntimeDs(dbId);
  _loaded.set(dbId, ds);
  return { id: dbIdToStrId(dbId), name: name.trim(), active: false };
}

export function updateWorkspace(id: string, name: string): WorkspaceOut {
  const dbId = strIdToDbId(id);
  if (!name?.trim()) throw new Error("Le nom du workspace est requis.");
  const dup = db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name)).get();
  if (dup && dup.id !== dbId) throw new Error(`Un workspace nommé '${name}' existe déjà.`);
  const row = db.update(wsTable).set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(wsTable.id, dbId)).returning().get();
  if (!row) throw new Error(`Workspace '${id}' introuvable.`);
  const ds = _loaded.get(dbId);
  if (ds) ds.model.name = name.trim();
  return { id, name: name.trim(), active: dbId === _activeId };
}

export function deleteWorkspace(id: string): void {
  const all = db.select({ id: wsTable.id }).from(wsTable).all();
  if (all.length <= 1) throw new Error("Impossible de supprimer le dernier workspace.");
  const dbId = strIdToDbId(id);
  if (dbId === _activeId) throw new Error("Impossible de supprimer le workspace actif. Activez-en un autre d'abord.");
  const deleted = db.delete(wsTable).where(eq(wsTable.id, dbId)).returning({ id: wsTable.id }).get();
  if (!deleted) throw new Error(`Workspace '${id}' introuvable.`);
  _loaded.delete(dbId);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Flush the in-memory model of a DataSource back to the DB. */
export function saveDataSource(ds: DataSource): void {
  modelToDb(ds.workspaceDbId, ds.model);
}

/** Recompute cached element/relationship type lists after a mutation. */
export function recomputeDataSourceTypes(ds: DataSource): void {
  ds.elementTypes = [...new Set(ds.model.elements.map((e) => e.type).filter(Boolean))].sort();
  ds.relationshipTypes = [...new Set(ds.model.relationships.map((r) => r.type).filter(Boolean))].sort();
}
