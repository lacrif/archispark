/**
 * Parser for the ArchiMate 3.1 Open Exchange File format.
 * Root element: <model> with children <elements>, <relationships>, <organizations>,
 * <propertyDefinitions>, <views><diagrams><view>...
 *
 * XSDs: archimate3_Model.xsd, archimate3_View.xsd, archimate3_Diagram.xsd.
 */
import type { ArchiModel } from "@workspace/db";
export declare function parseOpenExchange(xmlContent: string): ArchiModel;
//# sourceMappingURL=oxf-parser.d.ts.map