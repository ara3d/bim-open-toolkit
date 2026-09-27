// Renders a file embed: a card naming the file the agent read or wrote, its media
// type, size, and hash, with the preview it was shown with. The notebook keeps the
// file's path and hash, not its bytes, so there is nothing on the host to compare
// with; refresh() only reports "snapshot" (contract.ts, Freshness).

import type { FileEmbed } from "../document/format";
import type { EmbedRenderer, Freshness } from "./contract";

const SHA_PREFIX_LENGTH = 12;
const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Bytes as a short, human count: "512 B", "3.4 KB". */
export function readableSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const text = unit === 0 ? String(value) : value.toFixed(1);
  return `${text} ${UNITS[unit]}`;
}

function baseName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export const renderFile: EmbedRenderer<FileEmbed> = (el, embed) => {
  const card = document.createElement("div");
  card.className = "notebook-embed notebook-embed-file";

  const name = document.createElement("div");
  name.className = "notebook-file-name";
  name.textContent = baseName(embed.path);
  card.appendChild(name);

  const metaParts: string[] = [];
  if (embed.mediaType !== undefined) metaParts.push(embed.mediaType);
  if (embed.bytes !== undefined) metaParts.push(readableSize(embed.bytes));
  if (embed.sha256 !== undefined) metaParts.push(embed.sha256.slice(0, SHA_PREFIX_LENGTH));
  const meta = document.createElement("div");
  meta.className = "notebook-file-meta";
  meta.textContent = metaParts.join(" · ");
  card.appendChild(meta);

  if (embed.preview !== undefined) {
    const preview = document.createElement("pre");
    preview.className = "notebook-file-preview";
    preview.textContent = embed.preview;
    card.appendChild(preview);
  }

  el.appendChild(card);

  return {
    async refresh(): Promise<Freshness> {
      return { state: "snapshot" };
    },
    destroy(): void {
      card.remove();
    },
  };
};
