/**
 * SVG (and optionally PNG) renderer for ArchiMate views.
 *
 * renderViewToSvg  – pure string generation, no runtime dependencies
 * renderViewToPng  – requires the optional "sharp" package
 */
import type { ArchiView, ArchiModel } from "@workspace/db";
export declare function renderViewToSvg(view: ArchiView, model: ArchiModel): string;
export declare function renderViewToPng(view: ArchiView, model: ArchiModel): Promise<Buffer>;
//# sourceMappingURL=renderer.d.ts.map