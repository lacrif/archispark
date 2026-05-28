/**
 * Tests for src/schemas.ts — ArchiMate constant sets.
 */

import { describe, it, expect } from "vitest";
import {
  ACCESS_TYPES,
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  VIEWPOINTS,
  PROPERTY_DEFINITION_TYPES,
} from "../src/schemas.js";

// ===========================================================================
// Unit tests – schema constants
// ===========================================================================

describe("Schema constants", () => {
  it("ELEMENT_TYPES has 62 types", () => {
    expect(ELEMENT_TYPES.size).toBe(62);
  });

  it("ELEMENT_TYPES contains Business Layer types", () => {
    const expected = [
      "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
      "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
      "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Application Layer types", () => {
    const expected = [
      "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
      "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
      "ApplicationEvent", "ApplicationService", "DataObject",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Technology Layer types", () => {
    const expected = [
      "Node", "Device", "SystemSoftware", "TechnologyCollaboration",
      "TechnologyInterface", "Path", "CommunicationNetwork", "TechnologyFunction",
      "TechnologyProcess", "TechnologyInteraction", "TechnologyEvent",
      "TechnologyService", "Artifact",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Motivation types", () => {
    const expected = [
      "Stakeholder", "Driver", "Assessment", "Goal", "Outcome",
      "Principle", "Requirement", "Constraint", "Meaning", "Value",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Strategy types", () => {
    for (const t of ["Resource", "Capability", "CourseOfAction", "ValueStream"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Implementation & Migration types", () => {
    for (const t of ["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Composites & Junctions", () => {
    for (const t of ["Grouping", "Location", "AndJunction", "OrJunction"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("RELATIONSHIP_TYPES has all 11 types", () => {
    const expected = new Set([
      "Composition", "Aggregation", "Assignment", "Realization", "Serving",
      "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
    ]);
    expect(RELATIONSHIP_TYPES).toEqual(expected);
  });

  it("ACCESS_TYPES are correct", () => {
    expect(ACCESS_TYPES).toEqual(new Set(["Access", "Read", "Write", "ReadWrite"]));
  });

  it("VIEWPOINTS has at least 20 entries", () => {
    expect(VIEWPOINTS.size).toBeGreaterThanOrEqual(20);
  });

  it("VIEWPOINTS contains standard viewpoints", () => {
    expect(VIEWPOINTS.has("Layered")).toBe(true);
    expect(VIEWPOINTS.has("Motivation")).toBe(true);
    expect(VIEWPOINTS.has("Strategy")).toBe(true);
  });

  it("PROPERTY_DEFINITION_TYPES contains expected types", () => {
    for (const t of ["string", "boolean", "date", "number", "enumeration"]) {
      expect(PROPERTY_DEFINITION_TYPES.has(t)).toBe(true);
    }
  });
});
