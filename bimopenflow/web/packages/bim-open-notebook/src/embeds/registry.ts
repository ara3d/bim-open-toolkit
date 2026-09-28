// The default renderer for each embed kind, and the one call the page makes.

import type { Embed } from "../document/format";
import type { EmbedContext, EmbedHandle, EmbedRegistry, EmbedRenderer } from "./contract";
import { renderChart } from "./chart";
import { renderFile } from "./file";
import { renderGraph } from "./graph";
import { renderPicture } from "./picture";
import { renderTable } from "./table";
import { renderValue } from "./value";
import { renderView3d } from "./view3d";

export const defaultRenderers: EmbedRegistry = {
  value: renderValue,
  table: renderTable,
  chart: renderChart,
  graph: renderGraph,
  view3d: renderView3d,
  picture: renderPicture,
  file: renderFile,
};

/** Renders any embed with the registry's renderer for its kind. */
export function renderEmbed(
  el: HTMLElement,
  embed: Embed,
  ctx: EmbedContext,
  registry: EmbedRegistry = defaultRenderers,
): EmbedHandle {
  // The registry pairs each kind with its renderer; TypeScript cannot narrow
  // an indexed lookup by the union's tag, so the pairing is asserted here once.
  const render = registry[embed.kind] as EmbedRenderer<Embed>;
  return render(el, embed, ctx);
}
