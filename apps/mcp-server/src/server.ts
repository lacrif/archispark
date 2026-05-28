/**
 * MCP server.
 *
 * Exposes the same 25 ArchiMate MCP tools via streamable-HTTP transport.
 * Reads from (and writes to) the same SQLite DB as the REST API.
 */

import { randomUUID } from "crypto";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import packageJson from "api/package.json" with { type: "json" };
import { dataSource } from "api/src/registry.js";
import {
  getModelInfo,
  listElementTypes,
  listElements,
  getElementById,
  listRelationshipTypes,
  listRelationships,
  getRelationshipById,
  listViews,
  getViewById,
  createView,
  createNode,
  createElement,
  updateElement,
  deleteElement,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  saveModel,
  listPropertyDefinitions,
  getPropertyDefinitionById,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "api/src/app.js";
import { renderViewToSvg, renderViewToPng } from "api/src/renderer.js";
import {
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  PROPERTY_DEFINITION_TYPES,
  type ElementUpdateIn,
  type RelationshipUpdateIn,
  type PropertyDefinitionUpdateIn,
} from "api/src/schemas.js";

// Re-export dataSource so main.ts can trigger init
export { dataSource };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _ELEMENT_TYPES_STR = [...ELEMENT_TYPES].sort().join(", ");
const _RELATIONSHIP_TYPES_STR = [...RELATIONSHIP_TYPES].sort().join(", ");
const _PROPERTY_DEFINITION_TYPES_STR = [...PROPERTY_DEFINITION_TYPES].sort().join(", ");

function toContent(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

// ---------------------------------------------------------------------------
// MCP server instance
// ---------------------------------------------------------------------------

const { version } = packageJson;

const mcpServer = new McpServer({ name: "ArchiMate MCP", version });

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "get_model_info",
  { description: "Retourne les métadonnées globales du modèle ArchiMate chargé (identifiant, nom, version, compteurs).", inputSchema: {} },
  async () => toContent(getModelInfo(dataSource))
);

mcpServer.registerTool(
  "list_element_types",
  { description: "Retourne la liste triée des types d'éléments ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(listElementTypes(dataSource))
);

mcpServer.registerTool(
  "list_elements",
  {
    description: `Liste les éléments du modèle avec filtres optionnels. element_type doit être un type ArchiMate 3.1 valide parmi: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      element_type: z.string().optional().describe("Type ArchiMate 3.1 (ex: ApplicationComponent)"),
      name: z.string().optional().describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
    },
  },
  async ({ element_type, name }) => {
    if (element_type && !ELEMENT_TYPES.has(element_type)) {
      throw new Error(`Type d'élément invalide: '${element_type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(listElements(dataSource, element_type, name));
  }
);

mcpServer.registerTool(
  "get_element",
  { description: "Retourne le détail d'un élément ArchiMate par son identifiant (champ 'identifier').", inputSchema: { element_id: z.string().describe("Identifiant de l'élément") } },
  async ({ element_id }) => toContent(getElementById(dataSource, element_id))
);

mcpServer.registerTool(
  "list_relationship_types",
  { description: "Retourne la liste triée des types de relations ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(listRelationshipTypes(dataSource))
);

mcpServer.registerTool(
  "list_relationships",
  {
    description: `Liste les relations du modèle avec filtres optionnels. rel_type doit être parmi: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      rel_type: z.string().optional().describe("Type de relation ArchiMate 3.1"),
      source_id_filter: z.string().optional().describe("Filtrer par identifiant source"),
      target_id: z.string().optional().describe("Filtrer par identifiant cible"),
    },
  },
  async ({ rel_type, source_id_filter, target_id }) => {
    if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
      throw new Error(`Type de relation invalide: '${rel_type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(listRelationships(dataSource, rel_type, source_id_filter, target_id));
  }
);

mcpServer.registerTool(
  "get_relationship",
  { description: "Retourne le détail d'une relation ArchiMate par son identifiant.", inputSchema: { relationship_id: z.string().describe("Identifiant de la relation") } },
  async ({ relationship_id }) => toContent(getRelationshipById(dataSource, relationship_id))
);

mcpServer.registerTool(
  "list_views",
  { description: "Liste toutes les vues du modèle avec leur nombre de nœuds et de connexions.", inputSchema: {} },
  async () => toContent(listViews(dataSource))
);

mcpServer.registerTool(
  "get_view",
  { description: "Retourne le détail d'une vue ArchiMate par son identifiant.", inputSchema: { view_id: z.string().describe("Identifiant de la vue") } },
  async ({ view_id }) => toContent(getViewById(dataSource, view_id))
);

// ---------------------------------------------------------------------------
// Mutation tools – Views & Nodes
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_view",
  {
    description: "Crée une nouvelle vue (diagramme) dans le modèle ArchiMate.",
    inputSchema: {
      name: z.string().describe("Nom de la vue"),
      viewpoint: z.string().optional().nullable().describe("Point de vue ArchiMate (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation (optionnel)"),
    },
  },
  async ({ name, viewpoint, documentation }) =>
    toContent(createView(dataSource, { name, viewpoint, documentation }))
);

mcpServer.registerTool(
  "create_node",
  {
    description: "Ajoute un nœud (représentation visuelle d'un élément) dans une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      element_id: z.string().describe("Identifiant de l'élément à représenter"),
      x: z.number().optional().nullable().describe("Position X en pixels"),
      y: z.number().optional().nullable().describe("Position Y en pixels"),
      w: z.number().optional().nullable().describe("Largeur en pixels"),
      h: z.number().optional().nullable().describe("Hauteur en pixels"),
    },
  },
  async ({ view_id, element_id, x, y, w, h }) =>
    toContent(createNode(dataSource, view_id, { element_id, x, y, w, h }))
);

// ---------------------------------------------------------------------------
// Mutation tools – Elements
// ---------------------------------------------------------------------------

const propertyItemSchema = z.object({
  property_definition_ref: z.string().describe("Référence à la définition de propriété"),
  value: z.string().describe("Valeur de la propriété"),
});

mcpServer.registerTool(
  "create_element",
  {
    description: `Crée un nouvel élément ArchiMate dans le modèle (en mémoire). Types valides: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de l'élément"),
      type: z.string().describe("Type ArchiMate 3.1 (ex: ApplicationComponent, BusinessActor)"),
      documentation: z.string().optional().nullable().describe("Documentation / description"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
    },
  },
  async ({ name, type, documentation, properties }) => {
    if (!ELEMENT_TYPES.has(type)) {
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(createElement(dataSource, { name, type, documentation, properties }));
  }
);

mcpServer.registerTool(
  "update_element",
  {
    description: "Met à jour un élément ArchiMate existant. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type ArchiMate 3.1"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation (null pour effacer)"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés (remplace les existantes)"),
    },
  },
  async ({ element_id, name, type, documentation, properties }) => {
    if (type && !ELEMENT_TYPES.has(type)) {
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    const input: ElementUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    return toContent(updateElement(dataSource, element_id, input));
  }
);

mcpServer.registerTool(
  "delete_element",
  {
    description: "Supprime un élément ArchiMate et toutes les relations qui le référencent.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à supprimer"),
    },
  },
  async ({ element_id }) => {
    deleteElement(dataSource, element_id);
    return toContent({ deleted: true, identifier: element_id });
  }
);

// ---------------------------------------------------------------------------
// Mutation tools – Relationships
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_relationship",
  {
    description: `Crée une nouvelle relation ArchiMate entre deux éléments. Types valides: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      type: z.string().describe("Type de relation ArchiMate 3.1 (ex: Association, Composition)"),
      source: z.string().describe("Identifiant de l'élément source"),
      target: z.string().describe("Identifiant de l'élément cible"),
      name: z.string().optional().nullable().describe("Nom de la relation (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
      access_type: z.string().optional().nullable().describe("Type d'accès (Access uniquement): Access, Read, Write, ReadWrite"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée (Association uniquement)"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence (Influence uniquement)"),
    },
  },
  async ({ type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (!RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(createRelationship(dataSource, { type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }));
  }
);

mcpServer.registerTool(
  "update_relationship",
  {
    description: "Met à jour une relation ArchiMate existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à modifier"),
      name: z.string().optional().nullable().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de relation"),
      source: z.string().optional().describe("Nouvel identifiant d'élément source"),
      target: z.string().optional().describe("Nouvel identifiant d'élément cible"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés"),
      access_type: z.string().optional().nullable().describe("Type d'accès"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence"),
    },
  },
  async ({ relationship_id, name, type, source, target, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (type && !RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    const input: RelationshipUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (source !== undefined) input.source = source;
    if (target !== undefined) input.target = target;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    if (access_type !== undefined) input.access_type = access_type;
    if (is_directed !== undefined) input.is_directed = is_directed;
    if (influence_strength !== undefined) input.influence_strength = influence_strength;
    return toContent(updateRelationship(dataSource, relationship_id, input));
  }
);

mcpServer.registerTool(
  "delete_relationship",
  {
    description: "Supprime une relation ArchiMate du modèle.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à supprimer"),
    },
  },
  async ({ relationship_id }) => {
    deleteRelationship(dataSource, relationship_id);
    return toContent({ deleted: true, identifier: relationship_id });
  }
);

// ---------------------------------------------------------------------------
// Tools – propertyDefinitions
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_property_definitions",
  { description: "Liste toutes les définitions de propriétés du modèle ArchiMate.", inputSchema: {} },
  async () => toContent(listPropertyDefinitions(dataSource))
);

mcpServer.registerTool(
  "get_property_definition",
  {
    description: "Retourne le détail d'une définition de propriété par son identifiant.",
    inputSchema: { id: z.string().describe("Identifiant de la définition de propriété") },
  },
  async ({ id }) => toContent(getPropertyDefinitionById(dataSource, id))
);

mcpServer.registerTool(
  "create_property_definition",
  {
    description: `Crée une nouvelle définition de propriété dans le modèle. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de la définition de propriété"),
      type: z.string().optional().describe("Type de données (string par défaut): string, boolean, date, number, enumeration"),
    },
  },
  async ({ name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    return toContent(createPropertyDefinition(dataSource, { name, type }));
  }
);

mcpServer.registerTool(
  "update_property_definition",
  {
    description: "Met à jour une définition de propriété existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      id: z.string().describe("Identifiant de la définition à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de données"),
    },
  },
  async ({ id, name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    const input: PropertyDefinitionUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    return toContent(updatePropertyDefinition(dataSource, id, input));
  }
);

mcpServer.registerTool(
  "delete_property_definition",
  {
    description: "Supprime une définition de propriété et retire toutes les propriétés associées des éléments et relations.",
    inputSchema: { id: z.string().describe("Identifiant de la définition à supprimer") },
  },
  async ({ id }) => {
    deletePropertyDefinition(dataSource, id);
    return toContent({ deleted: true, identifier: id });
  }
);

// ---------------------------------------------------------------------------
// Tools – persistence & rendering
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "save_model",
  {
    description: "Saves the current in-memory model to its source file on disk (Open Exchange XML).",
    inputSchema: {},
  },
  async () => toContent(saveModel(dataSource))
);

mcpServer.registerTool(
  "render_view",
  {
    description:
      "Génère une image SVG ou PNG d'une vue ArchiMate. " +
      "SVG est retourné directement (toujours disponible). " +
      "PNG nécessite le paquet optionnel 'sharp' (npm install sharp).",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à rendre"),
      format: z
        .enum(["svg", "png"])
        .optional()
        .describe("Format de sortie: 'svg' (défaut) ou 'png'"),
    },
  },
  async ({ view_id, format = "svg" }) => {
    const view = dataSource.model.views.find((v) => v.uuid === view_id);
    if (!view) throw new Error(`Vue '${view_id}' introuvable.`);
    if (format === "png") {
      const buf = await renderViewToPng(view, dataSource.model);
      return {
        content: [{ type: "image" as const, data: buf.toString("base64"), mimeType: "image/png" }],
      };
    }
    const svg = renderViewToSvg(view, dataSource.model);
    return {
      content: [{ type: "image" as const, data: Buffer.from(svg).toString("base64"), mimeType: "image/svg+xml" }],
    };
  }
);

// ---------------------------------------------------------------------------
// MCP HTTP transport (session-aware, streamable-http)
// ---------------------------------------------------------------------------

const mcpTransports: Record<string, StreamableHTTPServerTransport> = {};
const mcpSessionTimestamps: Record<string, number> = {};
const SESSION_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const id of Object.keys(mcpSessionTimestamps)) {
    if ((mcpSessionTimestamps[id] ?? 0) < cutoff) {
      delete mcpTransports[id];
      delete mcpSessionTimestamps[id];
    }
  }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express();

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(express.json());

app.post("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && mcpTransports[sessionId]) {
    mcpSessionTimestamps[sessionId] = Date.now();
    await mcpTransports[sessionId]!.handleRequest(req, res, req.body);
    return;
  }

  if (isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        mcpTransports[id] = transport;
        mcpSessionTimestamps[id] = Date.now();
      },
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: "Bad Request: missing or invalid session." });
});

app.get("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    return;
  }
  res.status(405).json({ error: "Method Not Allowed" });
});

app.delete("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    delete mcpTransports[sessionId];
    return;
  }
  res.status(404).json({ error: "Session not found" });
});
