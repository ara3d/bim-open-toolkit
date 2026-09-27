// Renders a file embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { FileEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderFile: EmbedRenderer<FileEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderFile(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
