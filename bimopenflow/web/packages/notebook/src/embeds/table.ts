// Renders a table embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { TableEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderTable: EmbedRenderer<TableEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderTable(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
