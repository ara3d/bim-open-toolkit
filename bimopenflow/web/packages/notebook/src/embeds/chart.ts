// Renders a chart embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { ChartEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderChart: EmbedRenderer<ChartEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderChart(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
