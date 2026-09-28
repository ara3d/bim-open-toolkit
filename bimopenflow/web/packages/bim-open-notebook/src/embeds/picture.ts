// Renders a picture embed: an image the agent made or the user attached, with its
// caption as a figure caption. Click enlarges it in place; there is nothing on the
// host to compare with, so refresh() only reports "snapshot" (contract.ts, Freshness).

import type { PictureEmbed } from "../document/format";
import type { EmbedRenderer, Freshness } from "./contract";

const ENLARGED_CLASS = "notebook-picture-enlarged";

export const renderPicture: EmbedRenderer<PictureEmbed> = (el, embed) => {
  const figure = document.createElement("figure");
  figure.className = "notebook-embed notebook-embed-picture";

  const img = document.createElement("img");
  img.src = embed.src;
  img.alt = embed.alt;
  img.className = "notebook-picture-image";
  const toggle = () => img.classList.toggle(ENLARGED_CLASS);
  img.addEventListener("click", toggle);
  figure.appendChild(img);

  if (embed.caption !== undefined) {
    const caption = document.createElement("figcaption");
    caption.textContent = embed.caption;
    figure.appendChild(caption);
  }

  el.appendChild(figure);

  return {
    async refresh(): Promise<Freshness> {
      return { state: "snapshot" };
    },
    destroy(): void {
      img.removeEventListener("click", toggle);
      figure.remove();
    },
  };
};
