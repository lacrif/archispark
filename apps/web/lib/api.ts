export interface ModelInfo {
  identifier: string;
  name: string;
  documentation: string | null;
  version: string | null;
  element_count: number;
  relationship_count: number;
  view_count: number;
}

export interface Property {
  property_definition_ref: string;
  value: string;
}

export interface ElementOut {
  identifier: string;
  name: string;
  type: string;
  documentation: string | null;
  properties: Property[];
}

export interface RelationshipOut {
  identifier: string;
  name: string;
  type: string;
  source: string;
  target: string;
  documentation: string | null;
  properties: Property[];
}

export interface ViewOut {
  identifier: string;
  name: string;
  documentation: string | null;
}

export interface ViewDetail extends ViewOut {
  nodes: NodeOut[];
  connections: ConnectionOut[];
}

export interface NodeOut {
  identifier: string;
  element_ref: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string | null;
  nodes: NodeOut[];
}

export interface ConnectionOut {
  identifier: string;
  relationship_ref: string | null;
  source_node: string;
  target_node: string;
  label: string | null;
}

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const fetchModel = () => get<ModelInfo>("/");
export const fetchElementTypes = () => get<string[]>("/elements/types");

export async function fetchElements(
  type?: string | null,
  name?: string | null
): Promise<ElementOut[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const qs = params.toString();
  return get(`/elements${qs ? `?${qs}` : ""}`);
}

export const fetchRelationshipTypes = () => get<string[]>("/relationships/types");

export async function fetchRelationships(
  type?: string | null,
  name?: string | null
): Promise<RelationshipOut[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const qs = params.toString();
  return get(`/relationships${qs ? `?${qs}` : ""}`);
}

export const fetchViews = () => get<ViewOut[]>("/views");
export const fetchView = (id: string) => get<ViewDetail>(`/views/${encodeURIComponent(id)}`);

export function viewImageUrl(id: string, format: "svg" | "png" = "svg"): string {
  return `${BASE}/views/${encodeURIComponent(id)}/image?format=${format}`;
}

// --- Mutations ---

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export interface ElementCreateIn {
  name: string;
  type: string;
  documentation?: string | null;
}

export interface RelationshipCreateIn {
  name?: string | null;
  type: string;
  source: string;
  target: string;
  documentation?: string | null;
}

export interface ViewCreateIn {
  name: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
}

export interface ElementUpdateIn {
  name?: string;
  type?: string;
  documentation?: string | null;
}

export interface RelationshipUpdateIn {
  name?: string | null;
  type?: string;
  source?: string;
  target?: string;
  documentation?: string | null;
}

export interface ViewUpdateIn {
  name?: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

export const createElement = (body: ElementCreateIn) => post<ElementOut>("/elements", body);
export const updateElement = (id: string, body: ElementUpdateIn) => put<ElementOut>(`/elements/${encodeURIComponent(id)}`, body);
export const deleteElement = (id: string) => del(`/elements/${encodeURIComponent(id)}`);

export const createRelationship = (body: RelationshipCreateIn) => post<RelationshipOut>("/relationships", body);
export const updateRelationship = (id: string, body: RelationshipUpdateIn) => put<RelationshipOut>(`/relationships/${encodeURIComponent(id)}`, body);
export const deleteRelationship = (id: string) => del(`/relationships/${encodeURIComponent(id)}`);

export const createView = (body: ViewCreateIn) => post<ViewOut>("/views", body);
export const updateView = (id: string, body: ViewUpdateIn) => put<ViewOut>(`/views/${encodeURIComponent(id)}`, body);
export const deleteView = (id: string) => del(`/views/${encodeURIComponent(id)}`);

export const saveModel = () => post<{ saved: boolean; path: string }>("/save", {});
