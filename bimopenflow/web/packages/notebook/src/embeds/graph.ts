// Renders a graph embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { GraphEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderGraph: EmbedRenderer<GraphEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderGraph(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
