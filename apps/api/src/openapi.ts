/**
 * OpenAPI 3.0 specification for the mcp-archimate REST API.
 * Served as JSON at GET /openapi.json and as Swagger UI at GET /docs.
 */

import packageJson from "../package.json" with { type: "json" };
const { version } = packageJson;
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js";

const elementTypesEnum = [...ELEMENT_TYPES].sort();
const relationshipTypesEnum = [...RELATIONSHIP_TYPES].sort();

// ---------------------------------------------------------------------------
// Reusable schema objects
// ---------------------------------------------------------------------------

const RGBColor = {
  type: "object",
  properties: {
    r: { type: "integer", minimum: 0, maximum: 255 },
    g: { type: "integer", minimum: 0, maximum: 255 },
    b: { type: "integer", minimum: 0, maximum: 255 },
  },
  required: ["r", "g", "b"],
};

const Font = {
  type: "object",
  properties: {
    name:  { type: "string", nullable: true },
    size:  { type: "number", nullable: true },
    style: { type: "string", nullable: true },
    color: { $ref: "#/components/schemas/RGBColor", nullable: true },
  },
};

const Style = {
  type: "object",
  properties: {
    fill_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    line_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    font:        { $ref: "#/components/schemas/Font",     nullable: true },
    line_width:  { type: "number", nullable: true },
  },
};

const Property = {
  type: "object",
  required: ["property_definition_ref", "value"],
  properties: {
    property_definition_ref: { type: "string" },
    value:                   { type: "string" },
  },
};

const ModelInfo = {
  type: "object",
  required: ["identifier", "name", "element_count", "relationship_count", "view_count"],
  properties: {
    identifier:         { type: "string" },
    name:               { type: "string" },
    documentation:      { type: "string", nullable: true },
    version:            { type: "string", nullable: true },
    element_count:      { type: "integer" },
    relationship_count: { type: "integer" },
    view_count:         { type: "integer" },
  },
};

const Element = {
  type: "object",
  required: ["identifier", "name", "type", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string" },
    type:          { type: "string", enum: elementTypesEnum },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
  },
};

const Relationship = {
  type: "object",
  required: ["identifier", "type", "source", "target", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string", nullable: true },
    type:          { type: "string", enum: relationshipTypesEnum },
    source:        { type: "string", description: "Identifiant de l'element source" },
    source_name:   { type: "string", nullable: true },
    target:        { type: "string", description: "Identifiant de l'element cible" },
    target_name:   { type: "string", nullable: true },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
    access_type:   { type: "string", enum: ["Access", "Read", "Write", "ReadWrite"], nullable: true,
                     description: "Uniquement pour le type Access" },
    is_directed:   { type: "boolean", nullable: true,
                     description: "Uniquement pour le type Association" },
    modifier:      { type: "string", nullable: true,
                     description: "Force d'influence, uniquement pour le type Influence" },
  },
};

const Node: Record<string, unknown> = {
  type: "object",
  required: ["identifier", "children"],
  properties: {
    identifier:  { type: "string" },
    name:        { type: "string", nullable: true },
    element_ref: { type: "string", nullable: true },
    x:           { type: "integer", nullable: true },
    y:           { type: "integer", nullable: true },
    w:           { type: "integer", nullable: true },
    h:           { type: "integer", nullable: true },
    style:       { $ref: "#/components/schemas/Style", nullable: true },
    children:    { type: "array", items: { $ref: "#/components/schemas/Node" } },
  },
};

const Connection = {
  type: "object",
  required: ["identifier"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string", nullable: true },
    relationship_ref: { type: "string", nullable: true },
    source:           { type: "string", nullable: true },
    target:           { type: "string", nullable: true },
    style:            { $ref: "#/components/schemas/Style", nullable: true },
  },
};

const View = {
  type: "object",
  required: ["identifier", "name", "node_count", "connection_count"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string" },
    documentation:    { type: "string", nullable: true },
    viewpoint:        { type: "string", nullable: true },
    node_count:       { type: "integer" },
    connection_count: { type: "integer" },
  },
};

const ViewDetail = {
  allOf: [
    { $ref: "#/components/schemas/View" },
    {
      type: "object",
      required: ["nodes", "connections"],
      properties: {
        nodes:       { type: "array", items: { $ref: "#/components/schemas/Node" } },
        connections: { type: "array", items: { $ref: "#/components/schemas/Connection" } },
      },
    },
  ],
};

const ErrorDetail = {
  type: "object",
  required: ["detail"],
  properties: {
    detail: { type: "string" },
  },
};

const ElementCreateInput = {
  type: "object",
  required: ["name", "type"],
  properties: {
    name:          { type: "string", example: "Mon Application" },
    type:          { type: "string", enum: elementTypesEnum, example: "ApplicationComponent" },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
  },
};

const ElementUpdateInput = {
  type: "object",
  properties: {
    name:          { type: "string" },
    type:          { type: "string", enum: elementTypesEnum },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
  },
};

const RelationshipCreateInput = {
  type: "object",
  required: ["type", "source", "target"],
  properties: {
    name:               { type: "string", nullable: true },
    type:               { type: "string", enum: relationshipTypesEnum },
    source:             { type: "string", description: "Identifiant de l'element source" },
    target:             { type: "string", description: "Identifiant de l'element cible" },
    documentation:      { type: "string", nullable: true },
    properties:         { type: "array", items: { $ref: "#/components/schemas/Property" } },
    access_type:        { type: "string", enum: ["Access", "Read", "Write", "ReadWrite"], nullable: true },
    is_directed:        { type: "boolean", nullable: true },
    influence_strength: { type: "string", nullable: true },
  },
};

const RelationshipUpdateInput = {
  type: "object",
  properties: {
    name:               { type: "string", nullable: true },
    type:               { type: "string", enum: relationshipTypesEnum },
    source:             { type: "string" },
    target:             { type: "string" },
    documentation:      { type: "string", nullable: true },
    properties:         { type: "array", items: { $ref: "#/components/schemas/Property" } },
    access_type:        { type: "string", enum: ["Access", "Read", "Write", "ReadWrite"], nullable: true },
    is_directed:        { type: "boolean", nullable: true },
    influence_strength: { type: "string", nullable: true },
  },
};

const SaveResult = {
  type: "object",
  required: ["saved", "path"],
  properties: {
    saved: { type: "boolean", example: true },
    path:  { type: "string", example: "data/archisurance.xml" },
  },
};

const ViewCreateInput = {
  type: "object",
  required: ["name"],
  properties: {
    name:          { type: "string", example: "Vue applicative" },
    viewpoint:     { type: "string", nullable: true, example: "Application Structure" },
    documentation: { type: "string", nullable: true },
  },
};

const NodeCreateInput = {
  type: "object",
  required: ["element_id"],
  properties: {
    element_id: { type: "string", description: "Identifiant de l'élément à représenter" },
    x: { type: "number", nullable: true, example: 10 },
    y: { type: "number", nullable: true, example: 10 },
    w: { type: "number", nullable: true, example: 120 },
    h: { type: "number", nullable: true, example: 55 },
  },
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "mcp-archimate",
    version,
    description:
      "API REST pour interroger et modifier un modèle ArchiMate 3.1 au format Open Exchange File (.xml). " +
      "La source est configurée dans `config.json`.",
    contact: { name: "GitHub", url: "https://github.com/lacrif/mcp-archimate" },
  },
  servers: [{ url: "http://localhost:3000", description: "Serveur local" }],

  tags: [
    { name: "Model",         description: "Informations et persistance du modèle" },
    { name: "Elements",      description: "Elements ArchiMate" },
    { name: "Relationships", description: "Relations ArchiMate" },
    { name: "Views",         description: "Vues et diagrammes" },
    { name: "MCP",           description: "Transport MCP (streamable-http)" },
  ],

  paths: {
    "/": {
      get: {
        tags: ["Model"],
        summary: "Métadonnées du modèle",
        operationId: "getModelInfo",
        responses: {
          "200": {
            description: "Informations globales du modèle",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ModelInfo" } } },
          },
        },
      },
    },

    "/save": {
      post: {
        tags: ["Model"],
        summary: "Sauvegarder le modèle sur disque",
        operationId: "saveModel",
        description: "Sérialise le modèle en mémoire et l'écrit dans son fichier .xml (Open Exchange File).",
        responses: {
          "200": {
            description: "Modèle sauvegardé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SaveResult" } } },
          },
          "500": { description: "Erreur d'écriture", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } } },
        },
      },
    },

    "/elements/types": {
      get: {
        tags: ["Elements"],
        summary: "Types d'éléments présents",
        operationId: "listElementTypes",
        responses: {
          "200": {
            description: "Liste triée des types d'éléments ArchiMate 3.1 présents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["ApplicationComponent", "BusinessActor"] },
              },
            },
          },
        },
      },
    },

    "/elements": {
      get: {
        tags: ["Elements"],
        summary: "Lister les éléments",
        operationId: "listElements",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: elementTypesEnum },
            description: "Filtrer par type ArchiMate 3.1",
          },
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par nom (insensible a la casse, sous-chaine)",
          },
        ],
        responses: {
          "200": {
            description: "Liste des éléments",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Element" } },
              },
            },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      post: {
        tags: ["Elements"],
        summary: "Créer un élément",
        operationId: "createElement",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ElementCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Élément créé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/elements/{identifier}": {
      get: {
        tags: ["Elements"],
        summary: "Détail d'un élément",
        operationId: "getElementById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de l'élément",
          },
        ],
        responses: {
          "200": {
            description: "Élément ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Elements"],
        summary: "Modifier un élément",
        operationId: "updateElement",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ElementUpdateInput" } } },
        },
        responses: {
          "200": {
            description: "Élément mis à jour",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      delete: {
        tags: ["Elements"],
        summary: "Supprimer un élément",
        operationId: "deleteElement",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Élément supprimé (et relations associées)" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/relationships/types": {
      get: {
        tags: ["Relationships"],
        summary: "Types de relations présents",
        operationId: "listRelationshipTypes",
        responses: {
          "200": {
            description: "Liste triée des types de relations ArchiMate 3.1 présents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["Association", "Flow"] },
              },
            },
          },
        },
      },
    },

    "/relationships": {
      get: {
        tags: ["Relationships"],
        summary: "Lister les relations",
        operationId: "listRelationships",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: relationshipTypesEnum },
            description: "Filtrer par type de relation",
          },
          {
            name: "source_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'élément source",
          },
          {
            name: "target_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'élément cible",
          },
        ],
        responses: {
          "200": {
            description: "Liste des relations",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Relationship" } },
              },
            },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      post: {
        tags: ["Relationships"],
        summary: "Créer une relation",
        operationId: "createRelationship",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RelationshipCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Relation créée",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/relationships/{identifier}": {
      get: {
        tags: ["Relationships"],
        summary: "Détail d'une relation",
        operationId: "getRelationshipById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la relation",
          },
        ],
        responses: {
          "200": {
            description: "Relation ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Relationships"],
        summary: "Modifier une relation",
        operationId: "updateRelationship",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RelationshipUpdateInput" } } },
        },
        responses: {
          "200": {
            description: "Relation mise à jour",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      delete: {
        tags: ["Relationships"],
        summary: "Supprimer une relation",
        operationId: "deleteRelationship",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Relation supprimée" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/views": {
      get: {
        tags: ["Views"],
        summary: "Lister les vues",
        operationId: "listViews",
        responses: {
          "200": {
            description: "Liste des vues avec compteurs",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/View" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Views"],
        summary: "Créer une vue",
        operationId: "createView",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ViewCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Vue créée",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ViewDetail" } } },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/views/{view_id}/nodes": {
      post: {
        tags: ["Views"],
        summary: "Ajouter un nœud à une vue",
        operationId: "createNode",
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" }, description: "Identifiant de la vue" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/NodeCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Nœud créé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/views/{view_id}/image": {
      get: {
        tags: ["Views"],
        summary: "Rendu SVG ou PNG d'une vue",
        operationId: "renderView",
        parameters: [
          {
            name: "view_id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la vue",
          },
          {
            name: "format",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["svg", "png"], default: "svg" },
            description: "Format de sortie (svg par défaut, png nécessite le paquet sharp)",
          },
        ],
        responses: {
          "200": {
            description: "Image de la vue",
            content: {
              "image/svg+xml": { schema: { type: "string", format: "binary" } },
              "image/png":     { schema: { type: "string", format: "binary" } },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
          "500": {
            description: "Erreur de rendu (ex: paquet sharp manquant pour PNG)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
          },
        },
      },
    },

    "/views/{identifier}": {
      get: {
        tags: ["Views"],
        summary: "Détail d'une vue",
        operationId: "getViewById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la vue",
          },
        ],
        responses: {
          "200": {
            description: "Vue avec nœuds et connexions",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ViewDetail" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/mcp/": {
      post: {
        tags: ["MCP"],
        summary: "Requête MCP (JSON-RPC)",
        operationId: "mcpPost",
        description:
          "Point d'entrée JSON-RPC 2.0 du transport streamable-http MCP. " +
          "La première requête doit être une `initialize`. " +
          "Les requêtes suivantes doivent inclure l'en-tête `mcp-session-id` retourné par `initialize`.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Réponse JSON-RPC (text/event-stream ou application/json)" },
          "400": { description: "Session invalide ou requête non-initialize sans session" },
        },
      },
      get: {
        tags: ["MCP"],
        summary: "Flux SSE MCP",
        operationId: "mcpGet",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Flux d'événements SSE" },
          "405": { description: "Session non trouvée" },
        },
      },
      delete: {
        tags: ["MCP"],
        summary: "Fermer une session MCP",
        operationId: "mcpDelete",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Session fermée" },
          "404": { description: "Session non trouvée" },
        },
      },
    },
  },

  components: {
    schemas: {
      RGBColor,
      Font,
      Style,
      Property,
      SaveResult,
      ModelInfo,
      Element,
      ElementCreateInput,
      ElementUpdateInput,
      Relationship,
      RelationshipCreateInput,
      RelationshipUpdateInput,
      Node,
      Connection,
      View,
      ViewDetail,
      ViewCreateInput,
      NodeCreateInput,
      ErrorDetail,
    },
    responses: {
      NotFound: {
        description: "Ressource introuvable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
      UnprocessableType: {
        description: "Type ArchiMate invalide",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
    },
  },
};
