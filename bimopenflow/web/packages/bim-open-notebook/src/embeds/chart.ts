// Renders a chart embed on the existing chart pane (bar or line): drawn from
// its snapshot with no host call. refresh() compares the snapshot with the
// host's current result and redraws it when it changed.
//
// The chart pane (chartPane.ts) neither emits a "selection" PaneEvent nor
// acts on a "selection" PaneInput -- its update() only handles "table" and
// "legend" kinds, and its body never calls emit(). So this renderer does not
// wire the shared selection bus to it; see the report for TKT-80/N4.

import { createChartPane } from "@bimopenflow/panes";
import { makePaneContext } from "@bimopenflow/client";
import type { ChartEmbed } from "../document/format";
import type { EmbedHandle, EmbedRenderer } from "./contract";
import { compareWithHost } from "../live/compare";

/** Fixed chart height; width follows the column element the page gives us. */
const CHART_HEIGHT_PX = 320;

export const renderChart: EmbedRenderer<ChartEmbed> = (el, embed, ctx) => {
  const host = el.ownerDocument.createElement("div");
  host.style.width = "100%";
  host.style.height = `${CHART_HEIGHT_PX}px`;
  el.appendChild(host);

  const pane = createChartPane(embed.chart);
  const paneContext = makePaneContext(ctx.api, embed.source.analysisId);
  pane.mount(host, paneContext);
  pane.update({ kind: "table", data: embed.snapshot });

  let destroyed = false;

  return {
    async refresh() {
      const { freshness, current } = await compareWithHost(embed.source, embed.snapshot, ctx.api);
      if (freshness.state === "changed" && current) {
        pane.update({ kind: "table", data: current });
      }
      return freshness;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pane.destroy();
      host.remove();
    },
  };
};
