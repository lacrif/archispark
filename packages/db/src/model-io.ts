/**
 * Bidirectional conversion between the normalized SQLite DB and the in-memory ArchiModel.
 *
 * modelFromDb(workspaceId) — reads all rows and builds an ArchiModel.
 * modelToDb(workspaceId, model) — replaces all rows for the workspace with the model data.
 */

import { eq } from "drizzle-orm";
import { db } from "./connection.js";
import {
  workspaces,
  elements,
  relationships,
  propertyDefinitions,
  elementProperties,
  relationshipProperties,
  views,
  nodes,
  connections,
  bendpoints,
} from "./schema.js";
import type {
  ArchiModel,
  ArchiElement,
  ArchiRelationship,
  ArchiNode,
  ArchiConnection,
  ArchiView,
  ArchiPropertyDefinition,
  ArchiColor,
  BendPoint,
} from "./model.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToColor(r: number | null, g: number | null, b: number | null, a: number | null): ArchiColor | null {
  if (r == null && g == null && b == null) return null;
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0, a };
}

function buildNodeTree(
  flat: (typeof nodes.$inferSelect)[],
  parentUuid: string | null,
  elementMap: Map<string, ArchiElement>
): ArchiNode[] {
  return flat
    .filter((n) => (n.parentNodeUuid ?? null) === parentUuid)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((n) => {
      const ref = n.elementUuid
        ? (elementMap.get(n.elementUuid) ?? n.elementUuid)
        : null;
      return {
        uuid: n.uuid,
        name: n.name ?? null,
        ref,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        fill_color: rowToColor(n.fillColorR, n.fillColorG, n.fillColorB, n.fillColorA),
        line_color: rowToColor(n.lineColorR, n.lineColorG, n.lineColorB, n.lineColorA),
        font_name: n.fontName ?? null,
        font_size: n.fontSize ?? null,
        font_color: rowToColor(n.fontColorR, n.fontColorG, n.fontColorB, null),
        line_width: n.lineWidth ?? null,
        archi_type: null,
        nodes: buildNodeTree(flat, n.uuid, elementMap),
      } satisfies ArchiNode;
    });
}

// ---------------------------------------------------------------------------
// Load: DB → ArchiModel
// ---------------------------------------------------------------------------

export function modelFromDb(workspaceId: number): ArchiModel {
  const ws = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) throw new Error(`Workspace ${workspaceId} not found in DB`);

  // Elements
  const elemRows = db.select().from(elements).where(eq(elements.workspaceId, workspaceId)).all();
  const elemPropsRows = db.select().from(elementProperties)
    .innerJoin(elements, eq(elementProperties.elementId, elements.id))
    .where(eq(elements.workspaceId, workspaceId))
    .all();

  const elemPropsByElemId = new Map<number, Record<string, string>>();
  for (const row of elemPropsRows) {
    const ep = row.element_properties;
    const map = elemPropsByElemId.get(ep.elementId) ?? {};
    map[ep.propertyDefUuid] = ep.value;
    elemPropsByElemId.set(ep.elementId, map);
  }

  const archiElements: ArchiElement[] = elemRows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    type: r.type,
    desc: r.description ?? null,
    props: elemPropsByElemId.get(r.id) ?? {},
  }));

  const elementMap = new Map<string, ArchiElement>(archiElements.map((e) => [e.uuid, e]));

  // Relationships
  const relRows = db.select().from(relationships).where(eq(relationships.workspaceId, workspaceId)).all();
  const relPropsRows = db.select().from(relationshipProperties)
    .innerJoin(relationships, eq(relationshipProperties.relationshipId, relationships.id))
    .where(eq(relationships.workspaceId, workspaceId))
    .all();

  const relPropsByRelId = new Map<number, Record<string, string>>();
  for (const row of relPropsRows) {
    const rp = row.relationship_properties;
    const map = relPropsByRelId.get(rp.relationshipId) ?? {};
    map[rp.propertyDefUuid] = rp.value;
    relPropsByRelId.set(rp.relationshipId, map);
  }

  const archiRelationships: ArchiRelationship[] = relRows.map((r) => ({
    uuid: r.uuid,
    name: r.name ?? null,
    type: r.type,
    source: elementMap.get(r.sourceUuid) ?? r.sourceUuid,
    target: elementMap.get(r.targetUuid) ?? r.targetUuid,
    desc: r.description ?? null,
    props: relPropsByRelId.get(r.id) ?? {},
    access_type: r.accessType ?? null,
    is_directed: r.isDirected ?? null,
    influence_strength: r.influenceModifier ?? null,
  }));

  // Property definitions
  const pdRows = db.select().from(propertyDefinitions).where(eq(propertyDefinitions.workspaceId, workspaceId)).all();
  const archiPropDefs: ArchiPropertyDefinition[] = pdRows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    type: r.type,
  }));

  // Views
  const viewRows = db.select().from(views).where(eq(views.workspaceId, workspaceId)).all();

  const archiViews: ArchiView[] = viewRows.map((v) => {
    // Nodes (flat, will build tree)
    const nodeRows = db.select().from(nodes).where(eq(nodes.viewId, v.id)).all();
    const rootNodes = buildNodeTree(nodeRows, null, elementMap);

    // Connections
    const connRows = db.select().from(connections).where(eq(connections.viewId, v.id)).all();
    const bpRows = db.select().from(bendpoints)
      .innerJoin(connections, eq(bendpoints.connectionId, connections.id))
      .where(eq(connections.viewId, v.id))
      .all();

    const bpByConnId = new Map<number, BendPoint[]>();
    for (const row of bpRows) {
      const bp = row.bendpoints;
      const arr = bpByConnId.get(bp.connectionId) ?? [];
      arr.push({ x: bp.x, y: bp.y });
      bpByConnId.set(bp.connectionId, arr);
    }

    const archiConns: ArchiConnection[] = connRows.map((c) => ({
      uuid: c.uuid,
      name: c.name ?? null,
      ref: c.relationshipUuid ?? null,
      source: c.sourceNodeUuid ?? null,
      target: c.targetNodeUuid ?? null,
      line_color: rowToColor(c.lineColorR, c.lineColorG, c.lineColorB, c.lineColorA),
      font_name: c.fontName ?? null,
      font_size: c.fontSize ?? null,
      font_color: rowToColor(c.fontColorR, c.fontColorG, c.fontColorB, null),
      line_width: c.lineWidth ?? null,
      bendpoints: bpByConnId.get(c.id) ?? [],
    }));

    return {
      uuid: v.uuid,
      name: v.name,
      desc: v.description ?? null,
      primary_viewpoint: v.viewpoint ?? null,
      nodes: rootNodes,
      conns: archiConns,
    };
  });

  return {
    uuid: ws.uuid,
    name: ws.name,
    desc: ws.description ?? null,
    version: ws.version ?? null,
    elements: archiElements,
    relationships: archiRelationships,
    propertyDefinitions: archiPropDefs,
    views: archiViews,
  };
}

// ---------------------------------------------------------------------------
// Save: ArchiModel → DB  (replaces all rows for the workspace)
// ---------------------------------------------------------------------------

function colorToRow(c: ArchiColor | null): { r: number | null; g: number | null; b: number | null; a: number | null } {
  if (!c) return { r: null, g: null, b: null, a: null };
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? null };
}

function flattenNodes(
  nodeList: ArchiNode[],
  parentUuid: string | null,
  acc: Array<{
    uuid: string; name: string | null; elementUuid: string | null; parentNodeUuid: string | null;
    x: number | null; y: number | null; w: number | null; h: number | null;
    fillColorR: number | null; fillColorG: number | null; fillColorB: number | null; fillColorA: number | null;
    lineColorR: number | null; lineColorG: number | null; lineColorB: number | null; lineColorA: number | null;
    lineWidth: number | null; fontName: string | null; fontSize: number | null;
    fontColorR: number | null; fontColorG: number | null; fontColorB: number | null; fontColorA: number | null;
    sortOrder: number;
  }>,
  order: { i: number }
): void {
  for (const n of nodeList) {
    const ref = n.ref ? (typeof n.ref === "string" ? n.ref : n.ref.uuid) : null;
    const fill = colorToRow(n.fill_color);
    const line = colorToRow(n.line_color);
    const fontC = colorToRow(n.font_color);
    acc.push({
      uuid: n.uuid,
      name: n.name ?? null,
      elementUuid: ref,
      parentNodeUuid: parentUuid,
      x: n.x, y: n.y, w: n.w, h: n.h,
      fillColorR: fill.r, fillColorG: fill.g, fillColorB: fill.b, fillColorA: fill.a,
      lineColorR: line.r, lineColorG: line.g, lineColorB: line.b, lineColorA: line.a,
      lineWidth: n.line_width ?? null,
      fontName: n.font_name ?? null,
      fontSize: n.font_size ?? null,
      fontColorR: fontC.r, fontColorG: fontC.g, fontColorB: fontC.b, fontColorA: fontC.a,
      sortOrder: order.i++,
    });
    flattenNodes(n.nodes, n.uuid, acc, order);
  }
}

export function modelToDb(workspaceId: number, model: ArchiModel): void {
  db.transaction(() => {
    // Update workspace metadata (preserve workspace name — only update model uuid/desc/version)
    db.update(workspaces).set({
      uuid: model.uuid,
      description: model.desc ?? null,
      version: model.version ?? null,
      updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(workspaces.id, workspaceId)).run();

    // Clear all existing data for this workspace (cascade deletes children)
    db.delete(elements).where(eq(elements.workspaceId, workspaceId)).run();
    db.delete(relationships).where(eq(relationships.workspaceId, workspaceId)).run();
    db.delete(propertyDefinitions).where(eq(propertyDefinitions.workspaceId, workspaceId)).run();
    db.delete(views).where(eq(views.workspaceId, workspaceId)).run();

    // Property definitions
    for (const pd of model.propertyDefinitions) {
      db.insert(propertyDefinitions).values({
        workspaceId, uuid: pd.uuid, name: pd.name, type: pd.type,
      }).run();
    }

    // Elements
    for (const e of model.elements) {
      const res = db.insert(elements).values({
        workspaceId, uuid: e.uuid, type: e.type, name: e.name, description: e.desc ?? null,
      }).returning({ id: elements.id }).get();
      // v8 ignore next
      if (!res) continue;
      for (const [defUuid, value] of Object.entries(e.props)) {
        db.insert(elementProperties).values({ elementId: res.id, propertyDefUuid: defUuid, value }).run();
      }
    }

    // Relationships
    for (const r of model.relationships) {
      const srcUuid = typeof r.source === "string" ? r.source : r.source.uuid;
      const tgtUuid = typeof r.target === "string" ? r.target : r.target.uuid;
      const res = db.insert(relationships).values({
        workspaceId, uuid: r.uuid, type: r.type, name: r.name ?? null,
        description: r.desc ?? null, sourceUuid: srcUuid, targetUuid: tgtUuid,
        accessType: r.access_type ?? null,
        isDirected: r.is_directed ?? null,
        influenceModifier: r.influence_strength ?? null,
      }).returning({ id: relationships.id }).get();
      // v8 ignore next
      if (!res) continue;
      for (const [defUuid, value] of Object.entries(r.props)) {
        db.insert(relationshipProperties).values({ relationshipId: res.id, propertyDefUuid: defUuid, value }).run();
      }
    }

    // Views
    for (const v of model.views) {
      const vRes = db.insert(views).values({
        workspaceId, uuid: v.uuid, name: v.name,
        description: v.desc ?? null, viewpoint: v.primary_viewpoint ?? null,
      }).returning({ id: views.id }).get();
      // v8 ignore next
      if (!vRes) continue;
      const viewId = vRes.id;

      // Nodes (flatten tree)
      const flatNodes: Parameters<typeof flattenNodes>[2] = [];
      flattenNodes(v.nodes, null, flatNodes, { i: 0 });
      for (const n of flatNodes) {
        db.insert(nodes).values({ viewId, ...n }).run();
      }

      // Connections
      for (const c of v.conns) {
        const lineC = colorToRow(c.line_color);
        const fontC2 = colorToRow(c.font_color);
        const cRes = db.insert(connections).values({
          viewId, uuid: c.uuid, name: c.name ?? null,
          relationshipUuid: c.ref ?? null,
          sourceNodeUuid: c.source ?? null,
          targetNodeUuid: c.target ?? null,
          lineColorR: lineC.r, lineColorG: lineC.g, lineColorB: lineC.b, lineColorA: lineC.a,
          lineWidth: c.line_width ?? null,
          fontName: c.font_name ?? null,
          fontSize: c.font_size ?? null,
          fontColorR: fontC2.r, fontColorG: fontC2.g, fontColorB: fontC2.b, fontColorA: fontC2.a,
        }).returning({ id: connections.id }).get();
        // v8 ignore next
        if (!cRes) continue;
        if (c.bendpoints?.length) {
          for (let i = 0; i < c.bendpoints.length; i++) {
            const bp = c.bendpoints[i]!;
            db.insert(bendpoints).values({ connectionId: cRes.id, x: bp.x, y: bp.y, sortOrder: i }).run();
          }
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Seed: create a workspace row and populate from an ArchiModel
// ---------------------------------------------------------------------------

export function seedWorkspace(name: string, model: ArchiModel): number {
  const existing = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.name, name)).get();
  if (existing) return existing.id;

  const now = Math.floor(Date.now() / 1000);
  const ws = db.insert(workspaces).values({
    uuid: model.uuid, name, description: model.desc ?? null,
    version: model.version ?? null, createdAt: now, updatedAt: now,
  }).returning({ id: workspaces.id }).get();
  if (!ws) throw new Error("Failed to create workspace");

  modelToDb(ws.id, model);
  return ws.id;
}
