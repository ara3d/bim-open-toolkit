// Renders a value embed: one number or word read from the first row of a
// node's output. Draws the snapshot at once, with no host; refresh() compares
// with the host's current result and redraws when it changed.

import { compareWithHost } from "../live/compare";
import type { TableSnapshot, ValueEmbed } from "../document/format";
import type { EmbedRenderer, Freshness } from "./contract";

const NOT_AVAILABLE = "Not available";

/** Significant digits kept before trimming; enough to drop binary noise but keep real precision. */
const SIGNIFICANT_DIGITS = 12;

/**
 * Adds thousands separators to a number's integer part, after rounding away
 * floating-point noise: a sum such as 37196.19999999999 keeps its real value,
 * 37196.2, instead of showing every bit of the binary representation.
 */
export function formatNumber(value: number): string {
  const rounded = Number.isFinite(value) ? Number(value.toPrecision(SIGNIFICANT_DIGITS)) : value;
  const text = String(rounded);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction] = unsigned.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + grouped + (fraction !== undefined ? `.${fraction}` : "");
}

function columnIndexOf(snapshot: TableSnapshot, column?: string): number {
  if (!column) return 0;
  const i = snapshot.columns.findIndex((c) => c.name === column);
  return i < 0 ? 0 : i;
}

function formatCell(snapshot: TableSnapshot, column: string | undefined): string | null {
  if (snapshot.rows.length === 0) return null;
  const idx = columnIndexOf(snapshot, column);
  const cell = snapshot.rows[0][idx];
  if (cell === null || cell === undefined) return null;
  return typeof cell === "number" ? formatNumber(cell) : String(cell);
}

export const renderValue: EmbedRenderer<ValueEmbed> = (el, embed, ctx) => {
  const doc = el.ownerDocument;
  const root = doc.createElement("div");
  root.className = "bof-notebook-value";
  el.appendChild(root);

  const numberEl = doc.createElement("span");
  numberEl.className = "bof-notebook-value-number";
  const unitEl = doc.createElement("span");
  unitEl.className = "bof-notebook-value-unit";

  const draw = (snapshot: TableSnapshot): void => {
    root.textContent = "";
    const formatted = formatCell(snapshot, embed.column);
    if (formatted === null) {
      numberEl.textContent = NOT_AVAILABLE;
      unitEl.textContent = "";
      root.appendChild(numberEl);
      return;
    }
    numberEl.textContent = formatted;
    root.appendChild(numberEl);
    if (embed.unit) {
      unitEl.textContent = ` ${embed.unit}`;
      root.appendChild(unitEl);
    }
  };

  draw(embed.snapshot);

  return {
    async refresh(): Promise<Freshness> {
      const { freshness, current } = await compareWithHost(embed.source, embed.snapshot, ctx.api);
      if (freshness.state === "changed" && current) draw(current);
      return freshness;
    },
    destroy() {
      root.remove();
    },
  };
};
