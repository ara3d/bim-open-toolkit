// Renders a value embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { ValueEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderValue: EmbedRenderer<ValueEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderValue(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
