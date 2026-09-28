// Comparing an embed's snapshot with the host's current result.

import type { TableSlice } from "@bimopenflow/contracts";
import type { NodeRef, TableSnapshot } from "../document/format";
import type { Freshness, NotebookApi } from "../embeds/contract";

/** Rows a new snapshot keeps; the total count is kept separately. */
export const SNAPSHOT_ROWS = 50;

/** The outcome of one comparison, with the current result when the host gave one. */
export interface Comparison {
  readonly freshness: Freshness;
  readonly current?: TableSnapshot;
}

/** A snapshot of a host slice: its columns, at most `maxRows` rows, and the true total. */
export function snapshotOf(slice: TableSlice, maxRows: number = SNAPSHOT_ROWS): TableSnapshot {
  return { ...slice, rows: slice.rows.slice(0, maxRows) };
}

/** Same columns (name and type), same total, and the same cells in the rows both hold. */
export function sameSnapshot(a: TableSnapshot, b: TableSnapshot): boolean {
  const shared = Math.min(a.rows.length, b.rows.length);
  return (
    a.totalRows === b.totalRows &&
    a.columns.length === b.columns.length &&
    a.columns.every((c, i) => c.name === b.columns[i].name && c.type === b.columns[i].type) &&
    a.rows.slice(0, shared).every((row, i) => sameRow(row, b.rows[i]))
  );
}

const sameRow = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((cell, i) => cell === b[i]);

/** A few words for a snapshot: the value of a 1x1 result, else its shape. */
export function describeSnapshot(snapshot: TableSnapshot): string {
  if (snapshot.totalRows === 0) return "no rows";
  if (snapshot.totalRows === 1 && snapshot.columns.length === 1 && snapshot.rows.length > 0)
    return String(snapshot.rows[0][0]);
  const rows = `${snapshot.totalRows} row${snapshot.totalRows === 1 ? "" : "s"}`;
  return `${rows} × ${snapshot.columns.length} column${snapshot.columns.length === 1 ? "" : "s"}`;
}

/**
 * Reads the node's current result (as many rows as the snapshot holds, at
 * least one) and compares. Any failure to read becomes "unavailable" with the
 * host's message; this function does not reject.
 */
export async function compareWithHost(
  source: NodeRef,
  snapshot: TableSnapshot,
  api: Pick<NotebookApi, "getResult">,
): Promise<Comparison> {
  try {
    const slice = await api.getResult(
      source.analysisId,
      source.nodeId,
      source.port,
      0,
      Math.max(1, snapshot.rows.length),
    );
    const current = snapshotOf(slice, Math.max(1, snapshot.rows.length));
    return sameSnapshot(snapshot, current)
      ? { freshness: { state: "current" }, current }
      : {
          freshness: { state: "changed", was: describeSnapshot(snapshot), now: describeSnapshot(current) },
          current,
        };
  } catch (e) {
    return { freshness: { state: "unavailable", reason: e instanceof Error ? e.message : String(e) } };
  }
}
