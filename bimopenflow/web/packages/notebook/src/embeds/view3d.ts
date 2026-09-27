// Renders a view3d embed. Stub: replaced by its chunk (docs/plans/notebook.md).

import type { View3dEmbed } from "../document/format";
import type { EmbedRenderer } from "./contract";

export const renderView3d: EmbedRenderer<View3dEmbed> = (el, embed, ctx) => {
  throw new Error(`not built: renderView3d(${el.tagName}, ${embed.id}, ${typeof ctx})`);
};
