// The renderers every page has, how a page adds more, and the one call the page makes.
// The 3D embed needs the viewer, so a page registers it (src/page/view3dEmbed.ts).

import type { Embed } from "../document/format";
import type { EmbedContext, EmbedHandle, EmbedRegistry, EmbedRenderer } from "./contract";
import { renderChart } from "./chart";
import { renderFile } from "./file";
import { renderGraph } from "./graph";
import { renderPicture } from "./picture";
import { renderTable } from "./table";
import { renderValue } from "./value";

export const defaultRenderers: EmbedRegistry = {
  value: renderValue,
  table: renderTable,
  chart: renderChart,
  graph: renderGraph,
  picture: renderPicture,
  file: renderFile,
};

/** `base` with `extra`'s renderers added or replaced. */
export function withRenderers(base: EmbedRegistry, extra: EmbedRegistry): EmbedRegistry {
  return { ...base, ...extra };
}

/** What a kind with no renderer shows: the embed's caption, or its kind when it has none. */
function renderCaption(el: HTMLElement, embed: Embed): EmbedHandle {
  const figure = el.ownerDocument.createElement("figure");
  figure.className = "bof-nb-embed-caption";
  const caption = el.ownerDocument.createElement("figcaption");
  caption.textContent = embed.caption ?? `${embed.kind} view (no renderer on this page)`;
  figure.append(caption);
  el.append(figure);
  return {
    refresh: async () => ({ state: "snapshot" }),
    destroy: () => figure.remove(),
  };
}

/** Renders any embed with the registry's renderer for its kind. */
export function renderEmbed(
  el: HTMLElement,
  embed: Embed,
  ctx: EmbedContext,
  registry: EmbedRegistry = defaultRenderers,
): EmbedHandle {
  // The registry pairs each kind with its renderer; TypeScript cannot narrow
  // an indexed lookup by the union's tag, so the pairing is asserted here once.
  const render = registry[embed.kind] as EmbedRenderer<Embed> | undefined;
  if (!render) return renderCaption(el, embed);
  return render(el, embed, ctx);
}
