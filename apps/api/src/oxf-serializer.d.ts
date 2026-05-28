/**
 * Serializer for ArchiModel → ArchiMate 3.1 Open Exchange File format XML.
 * Inverse of oxf-parser.ts.
 *
 * Rebuilds <elements>, <relationships>, <views> from the in-memory ArchiModel.
 * Preserves <metadata>, <propertyDefinitions>, <organizations>, <viewpoints>
 * subtrees from `_raw` when present (lossless round-trip for those sections).
 */
import type { ArchiModel } from "@workspace/db";
export declare function serializeToOpenExchange(model: ArchiModel): string;
export declare function saveModelToFile(model: ArchiModel, filePath: string): void;
//# sourceMappingURL=oxf-serializer.d.ts.map