// Renders a table embed on the existing table pane, or the verdict pane when
// the snapshot's columns are the compliance convention (checkId, verdict).
// Draws the snapshot at once, with no host; "Show more" pages further rows
// through the host, and refresh() compares with the host's current result.

import { createTablePane, createVerdictPane, type Pane } from "@bimopenflow/panes";
import { makePaneContext } from "@bimopenflow/app/src/paneContext";
import { compareWithHost, SNAPSHOT_ROWS } from "../live/compare";
import type { TableSnapshot, TableEmbed } from "../document/format";
import type { EmbedRenderer, Freshness } from "./contract";

const isVerdictSnapshot = (snapshot: TableSnapshot): boolean =>
  snapshot.columns.some((c) => c.name === "checkId") &&
  snapshot.columns.some((c) => c.name === "verdict");

const rowsInfo = (held: number, total: number): string => `showing ${held} of ${total} rows`;

export const renderTable: EmbedRenderer<TableEmbed> = (el, embed, ctx) => {
  const doc = el.ownerDocument;
  const root = doc.createElement("div");
  root.className = "bof-notebook-table";
  el.appendChild(root);

  if (embed.caption) {
    const captionEl = doc.createElement("div");
    captionEl.className = "bof-notebook-table-caption";
    captionEl.textContent = embed.caption;
    root.appendChild(captionEl);
  }

  const paneHost = doc.createElement("div");
  root.appendChild(paneHost);

  const infoEl = doc.createElement("div");
  infoEl.className = "bof-notebook-table-info";
  root.appendChild(infoEl);

  const moreButton = doc.createElement("button");
  moreButton.className = "bof-notebook-table-more";
  moreButton.type = "button";
  moreButton.textContent = "Show more";
  root.appendChild(moreButton);

  const isVerdict = isVerdictSnapshot(embed.snapshot);
  const pane: Pane = isVerdict ? createVerdictPane() : createTablePane();
  pane.mount(paneHost, makePaneContext(ctx.api, embed.source.analysisId));

  let held: TableSnapshot = embed.snapshot;

  const updateInfo = (): void => {
    infoEl.textContent = rowsInfo(held.rows.length, held.totalRows);
    // More rows come from the host; a hostless page keeps the snapshot's rows.
    moreButton.style.display = ctx.hostless || held.rows.length >= held.totalRows ? "none" : "";
  };

  const draw = (snapshot: TableSnapshot): void => {
    held = snapshot;
    pane.update({ kind: "table", data: held });
    updateInfo();
  };

  draw(embed.snapshot);

  pane.onEvent((e) => {
    if (e.kind === "selection") ctx.selection.publish(e.event.ids, embed.id);
  });
  const unsubscribe = ctx.selection.subscribe((ids, origin) => {
    if (origin !== embed.id) pane.update({ kind: "selection", ids: [...ids] });
  });

  moreButton.addEventListener("click", () => {
    void (async () => {
      const skip = held.rows.length;
      const slice = await ctx.api.getResult(
        embed.source.analysisId,
        embed.source.nodeId,
        embed.source.port,
        skip,
        SNAPSHOT_ROWS,
      );
      draw({ ...slice, rows: [...held.rows, ...slice.rows] });
    })();
  });

  let destroyed = false;

  return {
    async refresh(): Promise<Freshness> {
      const { freshness, current } = await compareWithHost(embed.source, held, ctx.api);
      if (freshness.state === "changed" && current) draw(current);
      return freshness;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      pane.destroy();
      root.remove();
    },
  };
};
