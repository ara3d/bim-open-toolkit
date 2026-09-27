// Renders a picture embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { PictureEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderPicture: EmbedRenderer<PictureEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderPicture(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
