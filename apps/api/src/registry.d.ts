/**
 * Single ArchiMate model source loader.
 * Reads config.json at startup and parses the configured Open Exchange File (.xml).
 */
import type { ArchiModel } from "@workspace/db";
export interface DataSource {
    readonly path: string;
    readonly model: ArchiModel;
    /** Sorted unique element types present in the model. */
    elementTypes: string[];
    /** Sorted unique relationship types present in the model. */
    relationshipTypes: string[];
}
export declare const dataSource: DataSource;
/** Recompute elementTypes and relationshipTypes after a mutation. */
export declare function recomputeDataSourceTypes(ds: DataSource): void;
//# sourceMappingURL=registry.d.ts.map