/**
 * Internal model types for ArchiMate models (Open Exchange Format).
 * Parsing is handled by oxf-parser.ts in apps/api.
 */

export interface ArchiColor {
  r: number;
  g: number;
  b: number;
  a?: number | null;
}

export interface ArchiFont {
  name?: string | null;
  size?: number | null;
  style?: string | null;
  color?: ArchiColor | null;
}

export interface ArchiElement {
  uuid: string;
  name: string;
  type: string;
  desc: string | null;
  props: Record<string, string>;
}

export interface ArchiRelationship {
  uuid: string;
  name: string | null;
  type: string;
  source: ArchiElement | string;
  target: ArchiElement | string;
  desc: string | null;
  props: Record<string, string>;
  access_type: string | null;
  is_directed: boolean | null;
  influence_strength: string | null;
}

export interface ArchiNode {
  uuid: string;
  name: string | null;
  ref: ArchiElement | string | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  fill_color: ArchiColor | null;
  line_color: ArchiColor | null;
  font_name: string | null;
  font_size: number | null;
  font_color: ArchiColor | null;
  line_width: number | null;
  archi_type: number | null;
  nodes: ArchiNode[];
}

export interface BendPoint {
  x: number;
  y: number;
}

export interface ArchiConnection {
  uuid: string;
  name: string | null;
  ref: string | null;
  source: string | null;
  target: string | null;
  line_color: ArchiColor | null;
  font_name: string | null;
  font_size: number | null;
  font_color: ArchiColor | null;
  line_width: number | null;
  bendpoints?: BendPoint[];
}

export interface ArchiView {
  uuid: string;
  name: string;
  desc: string | null;
  primary_viewpoint: string | null;
  nodes: ArchiNode[];
  conns: ArchiConnection[];
}

export interface ArchiPropertyDefinition {
  uuid: string;
  name: string;
  type: string;
}

export interface ArchiModel {
  uuid: string;
  name: string;
  desc: string | null;
  version: string | null;
  elements: ArchiElement[];
  relationships: ArchiRelationship[];
  propertyDefinitions: ArchiPropertyDefinition[];
  views: ArchiView[];
  /** Raw parsed Open Exchange Format model node — preserved for lossless round-trip. */
  _raw?: unknown;
}
