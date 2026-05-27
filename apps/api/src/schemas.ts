/**
 * TypeScript types and ArchiMate 3.1 constants aligned with the Open Exchange Format XSD.
 * Sources: archimate3_Model.xsd, archimate3_View.xsd, archimate3_Diagram.xsd (v3.1).
 */

// ---------------------------------------------------------------------------
// ArchiMate 3.1 type constants (archimate3_Model.xsd)
// ---------------------------------------------------------------------------

export const ELEMENT_TYPES: ReadonlySet<string> = new Set([
  // Business Layer
  "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
  "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
  "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
  // Application Layer
  "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
  "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
  "ApplicationEvent", "ApplicationService", "DataObject",
  // Technology Layer
  "Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface",
  "Path", "CommunicationNetwork", "TechnologyFunction", "TechnologyProcess",
  "TechnologyInteraction", "TechnologyEvent", "TechnologyService", "Artifact",
  // Physical Layer
  "Equipment", "Facility", "DistributionNetwork", "Material",
  // Motivation
  "Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle",
  "Requirement", "Constraint", "Meaning", "Value",
  // Strategy
  "Resource", "Capability", "CourseOfAction", "ValueStream",
  // Implementation & Migration
  "WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap",
  // Composites & Junctions
  "Grouping", "Location", "AndJunction", "OrJunction",
]);

export const RELATIONSHIP_TYPES: ReadonlySet<string> = new Set([
  "Composition", "Aggregation", "Assignment", "Realization", "Serving",
  "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
]);

export const ACCESS_TYPES: ReadonlySet<string> = new Set([
  "Access", "Read", "Write", "ReadWrite",
]);

export const VIEWPOINTS: ReadonlySet<string> = new Set([
  "Organization", "Application Platform", "Application Structure",
  "Information Structure", "Technology", "Layered", "Physical",
  "Product", "Application Usage", "Technology Usage",
  "Business Process Cooperation", "Application Cooperation",
  "Service Realization", "Implementation and Deployment",
  "Goal Realization", "Goal Contribution", "Principles",
  "Requirements Realization", "Motivation", "Strategy",
  "Capability Map", "Outcome Realization", "Resource Map", "Value Stream",
  "Project", "Migration", "Implementation and Migration", "Stakeholder",
]);

// ---------------------------------------------------------------------------
// Style sub-types (archimate3_Diagram.xsd)
// ---------------------------------------------------------------------------

export interface RGBColorOut {
  r: number;
  g: number;
  b: number;
  a?: number | null;
}

export interface FontOut {
  name?: string | null;
  size?: number | null;
  style?: string | null;
  color?: RGBColorOut | null;
}

export interface StyleOut {
  line_color?: RGBColorOut | null;
  fill_color?: RGBColorOut | null;
  font?: FontOut | null;
  line_width?: number | null;
}

// ---------------------------------------------------------------------------
// Property sub-type (archimate3_Model.xsd PropertyType)
// ---------------------------------------------------------------------------

export interface PropertyOut {
  property_definition_ref: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Top-level API output schemas
// ---------------------------------------------------------------------------

export interface ModelInfo {
  identifier: string;
  name: string;
  documentation?: string | null;
  version?: string | null;
  element_count: number;
  relationship_count: number;
  view_count: number;
}

export interface ElementOut {
  identifier: string;
  name: string;
  type: string;
  documentation?: string | null;
  properties: PropertyOut[];
}

export interface RelationshipOut {
  identifier: string;
  name?: string | null;
  type: string;
  source: string;
  source_name?: string | null;
  target: string;
  target_name?: string | null;
  documentation?: string | null;
  properties: PropertyOut[];
  access_type?: string | null;
  is_directed?: boolean | null;
  modifier?: string | null;
}

export interface ConnectionOut {
  identifier: string;
  name?: string | null;
  relationship_ref?: string | null;
  source?: string | null;
  target?: string | null;
  style?: StyleOut | null;
}

export interface NodeOut {
  identifier: string;
  name?: string | null;
  element_ref?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  style?: StyleOut | null;
  children: NodeOut[];
}

export interface ViewOut {
  identifier: string;
  name: string;
  documentation?: string | null;
  viewpoint?: string | null;
  node_count: number;
  connection_count: number;
}

export interface ViewDetailOut extends ViewOut {
  nodes: NodeOut[];
  connections: ConnectionOut[];
}

// ---------------------------------------------------------------------------
// Input schemas for mutation operations (create / update)
// ---------------------------------------------------------------------------

export interface ElementCreateIn {
  name: string;
  type: string;
  documentation?: string | null;
  properties?: PropertyOut[];
}

export interface ElementUpdateIn {
  name?: string;
  type?: string;
  documentation?: string | null;
  properties?: PropertyOut[];
}

export interface RelationshipCreateIn {
  name?: string | null;
  type: string;
  source: string;
  target: string;
  documentation?: string | null;
  properties?: PropertyOut[];
  access_type?: string | null;
  is_directed?: boolean | null;
  influence_strength?: string | null;
}

export interface RelationshipUpdateIn {
  name?: string | null;
  type?: string;
  source?: string;
  target?: string;
  documentation?: string | null;
  properties?: PropertyOut[];
  access_type?: string | null;
  is_directed?: boolean | null;
  influence_strength?: string | null;
}

export interface SaveResult {
  saved: boolean;
  path: string;
}

export interface ViewCreateIn {
  name: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

export interface ViewUpdateIn {
  name?: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

export interface NodeCreateIn {
  element_id: string;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
}
