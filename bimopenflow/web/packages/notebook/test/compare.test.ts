import { describe, expect, it } from "vitest";
import type { TableSlice } from "@bimopenflow/contracts";
import { compareWithHost, describeSnapshot, sameSnapshot, snapshotOf } from "../src/live/compare";

const total = (value: number): TableSlice => ({
  columns: [{ name: "total", type: "Number" }],
  rows: [[value]],
  totalRows: 1,
  skip: 0,
});

const source = { analysisId: "nrc-q1-building-total", nodeId: "answer", port: "table" };
const hostWith = (slice: TableSlice) => ({ getResult: async () => slice });

describe("snapshot comparison", () => {
  it("keeps the first rows and the true total", () => {
    const slice: TableSlice = { ...total(1), rows: [[1], [2], [3]], totalRows: 3 };
    expect(snapshotOf(slice, 2)).toEqual({ ...slice, rows: [[1], [2]] });
  });

  it("treats a longer read of the same result as the same", () => {
    const long: TableSlice = { ...total(1), rows: [[1], [2]], totalRows: 2 };
    expect(sameSnapshot(snapshotOf(long, 1), long)).toBe(true);
  });

  it("describes a scalar by its value and a table by its shape", () => {
    expect(describeSnapshot(total(37196.2))).toBe("37196.2");
    expect(describeSnapshot({ ...total(1), rows: [[1], [2]], totalRows: 2 })).toBe("2 rows × 1 column");
    expect(describeSnapshot({ ...total(1), rows: [], totalRows: 0 })).toBe("no rows");
  });

  it("reports current when the host returns the snapshot", async () => {
    const result = await compareWithHost(source, total(37196.2), hostWith(total(37196.2)));
    expect(result.freshness).toEqual({ state: "current" });
  });

  it("reports both values when the host's result changed", async () => {
    const result = await compareWithHost(source, total(37196.2), hostWith(total(37200)));
    expect(result.freshness).toEqual({ state: "changed", was: "37196.2", now: "37200" });
    expect(result.current?.rows).toEqual([[37200]]);
  });

  it("reports unavailable instead of rejecting when the host fails", async () => {
    const failing = { getResult: async () => Promise.reject(new Error("404 node not Ok")) };
    const result = await compareWithHost(source, total(1), failing);
    expect(result.freshness).toEqual({ state: "unavailable", reason: "404 node not Ok" });
  });
});
