/**
 * Drizzle ORM schema for ArchiMate 3.1 — normalized SQLite tables.
 *
 * Design:
 *   - One database file (archispark.db) for all workspaces.
 *   - Every entity table has a workspace_id FK → workspaces.id.
 *   - UUIDs kept as TEXT to match the Open Exchange xs:ID format ("id-" prefix).
 *   - Colors stored as RGBA integers (0-255 / 0-100 alpha), NULL when not set.
 *   - Properties keyed by property_def_uuid (TEXT), split into element_properties
 *     and relationship_properties to avoid polymorphic FK.
 *   - Node nesting via parent_node_uuid (self-reference by UUID, not FK int).
 *   - Bendpoints for connection routing stored in a child table.
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Workspaces (replaces workspaces.json)
// ---------------------------------------------------------------------------

export const workspaces = sqliteTable("workspaces", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  uuid:        text("uuid").notNull(),          // ArchiMate model identifier (xs:ID)
  name:        text("name").notNull(),           // workspace / model display name
  description: text("description"),
  version:     text("version"),
  createdAt:   integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("workspaces_name_uniq").on(t.name),
]);

// ---------------------------------------------------------------------------
// Elements  (ArchiMate 3.1 — all layers)
// ---------------------------------------------------------------------------

export const elements = sqliteTable("elements", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  type:        text("type").notNull(),           // ArchiMate element type (ApplicationComponent, etc.)
  name:        text("name").notNull().default(""),
  description: text("description"),
}, (t) => [
  uniqueIndex("elements_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("elements_workspace_idx").on(t.workspaceId),
  index("elements_type_idx").on(t.workspaceId, t.type),
]);

// ---------------------------------------------------------------------------
// Relationships  (ArchiMate 3.1 — 11 structural + junction types)
// ---------------------------------------------------------------------------

export const relationships = sqliteTable("relationships", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  workspaceId:       integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:              text("uuid").notNull(),
  type:              text("type").notNull(),      // Composition, Aggregation, Assignment, …
  name:              text("name"),
  description:       text("description"),
  sourceUuid:        text("source_uuid").notNull(),
  targetUuid:        text("target_uuid").notNull(),
  accessType:        text("access_type"),         // Access: Read, Write, ReadWrite, Access
  isDirected:        integer("is_directed", { mode: "boolean" }),  // Association
  influenceModifier: text("influence_modifier"),  // Influence: +, ++, -, …
}, (t) => [
  uniqueIndex("relationships_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("relationships_workspace_idx").on(t.workspaceId),
  index("relationships_source_idx").on(t.workspaceId, t.sourceUuid),
  index("relationships_target_idx").on(t.workspaceId, t.targetUuid),
]);

// ---------------------------------------------------------------------------
// Property definitions  (schema for custom metadata)
// ---------------------------------------------------------------------------

export const propertyDefinitions = sqliteTable("property_definitions", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  name:        text("name").notNull(),
  type:        text("type").notNull().default("string"),  // string | boolean | date | number | enumeration
}, (t) => [
  uniqueIndex("prop_defs_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("prop_defs_workspace_idx").on(t.workspaceId),
]);

// ---------------------------------------------------------------------------
// Properties (key-value metadata on elements and relationships, split tables)
// ---------------------------------------------------------------------------

export const elementProperties = sqliteTable("element_properties", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  elementId:       integer("element_id").notNull().references(() => elements.id, { onDelete: "cascade" }),
  propertyDefUuid: text("property_def_uuid").notNull(),
  value:           text("value").notNull().default(""),
}, (t) => [
  index("elem_props_element_idx").on(t.elementId),
  index("elem_props_def_idx").on(t.propertyDefUuid),
]);

export const relationshipProperties = sqliteTable("relationship_properties", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  relationshipId:  integer("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  propertyDefUuid: text("property_def_uuid").notNull(),
  value:           text("value").notNull().default(""),
}, (t) => [
  index("rel_props_relationship_idx").on(t.relationshipId),
  index("rel_props_def_idx").on(t.propertyDefUuid),
]);

// ---------------------------------------------------------------------------
// Views  (ArchiMate diagrams)
// ---------------------------------------------------------------------------

export const views = sqliteTable("views", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  name:        text("name").notNull().default(""),
  description: text("description"),
  viewpoint:   text("viewpoint"),                // standard viewpoint name or custom string
}, (t) => [
  uniqueIndex("views_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("views_workspace_idx").on(t.workspaceId),
]);

// ---------------------------------------------------------------------------
// Nodes  (visual shapes in a view)
// ---------------------------------------------------------------------------

export const nodes = sqliteTable("nodes", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  viewId:         integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  uuid:           text("uuid").notNull(),
  name:           text("name"),
  elementUuid:    text("element_uuid"),           // ref → elements.uuid (NULL for containers/labels)
  parentNodeUuid: text("parent_node_uuid"),        // NULL = root node in view
  x:              integer("x"),
  y:              integer("y"),
  w:              integer("w"),
  h:              integer("h"),
  // Style — fill color
  fillColorR:     integer("fill_color_r"),
  fillColorG:     integer("fill_color_g"),
  fillColorB:     integer("fill_color_b"),
  fillColorA:     integer("fill_color_a"),
  // Style — line
  lineColorR:     integer("line_color_r"),
  lineColorG:     integer("line_color_g"),
  lineColorB:     integer("line_color_b"),
  lineColorA:     integer("line_color_a"),
  lineWidth:      integer("line_width"),
  // Style — font
  fontName:       text("font_name"),
  fontSize:       real("font_size"),
  fontColorR:     integer("font_color_r"),
  fontColorG:     integer("font_color_g"),
  fontColorB:     integer("font_color_b"),
  fontColorA:     integer("font_color_a"),
  sortOrder:      integer("sort_order").notNull().default(0),
}, (t) => [
  uniqueIndex("nodes_uuid_view_uniq").on(t.viewId, t.uuid),
  index("nodes_view_idx").on(t.viewId),
  index("nodes_parent_idx").on(t.viewId, t.parentNodeUuid),
  index("nodes_element_idx").on(t.elementUuid),
]);

// ---------------------------------------------------------------------------
// Connections  (visual connectors in a view)
// ---------------------------------------------------------------------------

export const connections = sqliteTable("connections", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  viewId:           integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  uuid:             text("uuid").notNull(),
  name:             text("name"),
  relationshipUuid: text("relationship_uuid"),     // ref → relationships.uuid
  sourceNodeUuid:   text("source_node_uuid"),
  targetNodeUuid:   text("target_node_uuid"),
  // Style — line
  lineColorR:       integer("line_color_r"),
  lineColorG:       integer("line_color_g"),
  lineColorB:       integer("line_color_b"),
  lineColorA:       integer("line_color_a"),
  lineWidth:        integer("line_width"),
  // Style — font
  fontName:         text("font_name"),
  fontSize:         real("font_size"),
  fontColorR:       integer("font_color_r"),
  fontColorG:       integer("font_color_g"),
  fontColorB:       integer("font_color_b"),
  fontColorA:       integer("font_color_a"),
}, (t) => [
  uniqueIndex("connections_uuid_view_uniq").on(t.viewId, t.uuid),
  index("connections_view_idx").on(t.viewId),
  index("connections_rel_idx").on(t.relationshipUuid),
]);

// ---------------------------------------------------------------------------
// Bendpoints  (waypoints for connection routing)
// ---------------------------------------------------------------------------

export const bendpoints = sqliteTable("bendpoints", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  connectionId: integer("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  x:            integer("x").notNull(),
  y:            integer("y").notNull(),
  sortOrder:    integer("sort_order").notNull().default(0),
}, (t) => [
  index("bendpoints_connection_idx").on(t.connectionId),
]);

// ---------------------------------------------------------------------------
// Users  (authentication — replaces users.json)
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id:           text("id").primaryKey(),            // UUID string
  username:     text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  role:         text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt:    integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("users_username_uniq").on(t.username),
]);
