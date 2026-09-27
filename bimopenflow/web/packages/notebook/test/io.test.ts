import { describe, expect, it } from "vitest";
import type { TableSnapshot, Notebook } from "../src/document/format";
import { NOTEBOOK_FORMAT } from "../src/document/format";
import { emptyNotebook, parseNotebook, serializeNotebook } from "../src/document/io";

const snapshot = (value: number): TableSnapshot => ({
  columns: [{ name: "total", type: "Number" }],
  rows: [[value]],
  totalRows: 1,
  skip: 0,
});

const source = { analysisId: "nrc-q1-building-total", nodeId: "answer", port: "table" };

/** A notebook exercising every embed kind, used for round-trip and rendering checks. */
const fullNotebook: Notebook = {
  format: NOTEBOOK_FORMAT,
  title: "NRC eight questions",
  createdUtc: "2026-09-27T00:00:00Z",
  host: { profile: "tables", note: "Snowdon export" },
  turns: [
    {
      id: "t1",
      request: { text: "What is the building's total embodied carbon?", atUtc: "2026-09-27T00:00:01Z" },
      reply: {
        text: "37,196.2 kgCO2e/yr.",
        tools: [{ name: "evaluate", ok: true, summary: "ran nrc-q1-building-total" }],
        embeds: [
          {
            id: "v1",
            kind: "value",
            source,
            column: "total",
            unit: "kgCO2e/yr",
            snapshot: snapshot(37196.2),
            caption: "Total embodied carbon",
          },
          {
            id: "tb1",
            kind: "table",
            source,
            snapshot: { ...snapshot(1), rows: [[1], [2]], totalRows: 2 },
          },
          {
            id: "c1",
            kind: "chart",
            source,
            chart: { chart: "bar", categoryColumn: "storey", valueColumn: "total" } as never,
            snapshot: snapshot(1),
          },
          {
            id: "g1",
            kind: "graph",
            analysisId: "nrc-q1-building-total",
            graphHash: "abc123",
            document: "{}",
            text: "table.duckdb -> value.sum",
            focus: ["answer"],
          },
          {
            id: "vw1",
            kind: "view3d",
            source,
            still: "still-q1.png",
          },
          {
            id: "p1",
            kind: "picture",
            src: "chart-q1.png",
            alt: "Bar chart of embodied carbon by storey",
          },
          {
            id: "f1",
            kind: "file",
            path: "exports/q1.xlsx",
            mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            bytes: 4096,
            sha256: "deadbeef",
            preview: "storey,total\n1,37196.2\n",
          },
        ],
        analysisId: "nrc-q1-building-total",
        agent: { model: "claude", effort: "medium", turns: 3, inputTokens: 512, outputTokens: 128 },
      },
    },
    {
      id: "t2",
      request: { text: "Which materials contribute most?" },
      reply: {
        text: "Concrete and steel.",
        tools: [],
        embeds: [],
      },
      stale: true,
      earlier: [
        {
          request: { text: "Which materials?" },
          reply: { text: "Concrete.", tools: [], embeds: [] },
        },
      ],
    },
  ],
};

describe("parseNotebook", () => {
  it("round-trips a notebook with every embed kind", () => {
    const text = serializeNotebook(fullNotebook);
    const result = parseNotebook(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notebook).toEqual(fullNotebook);
  });

  it("serializes the same notebook identically twice", () => {
    expect(serializeNotebook(fullNotebook)).toBe(serializeNotebook(fullNotebook));
  });

  it("produces two-space JSON with a final newline", () => {
    const text = serializeNotebook(emptyNotebook("Empty", "2026-09-27T00:00:00Z"));
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "title"');
  });

  it("accepts an empty notebook", () => {
    const notebook = emptyNotebook("Empty", "2026-09-27T00:00:00Z");
    const result = parseNotebook(serializeNotebook(notebook));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notebook).toEqual(notebook);
  });

  it("reports one error with the parser's message for invalid JSON", () => {
    const result = parseNotebook("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.length).toBeGreaterThan(0);
    }
  });

  it("rejects a non-object root", () => {
    const result = parseNotebook("[1, 2, 3]");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["(root): expected an object"]);
  });

  const validBase = {
    format: NOTEBOOK_FORMAT,
    title: "T",
    createdUtc: "2026-09-27T00:00:00Z",
    turns: [] as unknown[],
  };

  const cases: { readonly name: string; readonly doc: unknown; readonly errors: readonly string[] }[] = [
    {
      name: "wrong format tag",
      doc: { ...validBase, format: "bimopen-notebook/0.0" },
      errors: [`format: expected "${NOTEBOOK_FORMAT}"`],
    },
    {
      name: "missing title",
      doc: { format: NOTEBOOK_FORMAT, createdUtc: validBase.createdUtc, turns: [] },
      errors: ["title: missing"],
    },
    {
      name: "createdUtc not a string",
      doc: { ...validBase, createdUtc: 123 },
      errors: ["createdUtc: expected a string"],
    },
    {
      name: "unknown top-level field",
      doc: { ...validBase, extra: true },
      errors: ["extra: unknown field"],
    },
    {
      name: "turns not an array",
      doc: { ...validBase, turns: "nope" },
      errors: ["turns: expected an array"],
    },
    {
      name: "duplicate turn ids",
      doc: {
        ...validBase,
        turns: [
          { id: "dup", request: { text: "a" }, reply: { text: "a", tools: [], embeds: [] } },
          { id: "dup", request: { text: "b" }, reply: { text: "b", tools: [], embeds: [] } },
        ],
      },
      errors: [`turns[1].id: duplicate turn id "dup"`],
    },
    {
      name: "duplicate embed ids within a reply",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [],
              embeds: [
                { id: "e1", kind: "picture", src: "a.png", alt: "a" },
                { id: "e1", kind: "picture", src: "b.png", alt: "b" },
              ],
            },
          },
        ],
      },
      errors: [`turns[0].reply.embeds[1].id: duplicate embed id "e1" in this reply`],
    },
    {
      name: "unknown embed kind",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: { text: "a", tools: [], embeds: [{ id: "e1", kind: "movie" }] },
          },
        ],
      },
      errors: [`turns[0].reply.embeds[0].kind: unknown embed kind "movie"`],
    },
    {
      name: "value embed missing its source",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [],
              embeds: [{ id: "e1", kind: "value", snapshot: snapshot(1) }],
            },
          },
        ],
      },
      errors: ["turns[0].reply.embeds[0].source: missing"],
    },
    {
      name: "snapshot rows not an array",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [],
              embeds: [
                {
                  id: "e1",
                  kind: "table",
                  source,
                  snapshot: { ...snapshot(1), rows: "nope" },
                },
              ],
            },
          },
        ],
      },
      errors: ["turns[0].reply.embeds[0].snapshot.rows: expected an array"],
    },
    {
      name: "picture embed missing alt",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [],
              embeds: [{ id: "e1", kind: "picture", src: "a.png" }],
            },
          },
        ],
      },
      errors: ["turns[0].reply.embeds[0].alt: missing"],
    },
    {
      name: "chart embed with a bad chart tag",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [],
              embeds: [
                { id: "e1", kind: "chart", source, chart: { chart: "pie" }, snapshot: snapshot(1) },
              ],
            },
          },
        ],
      },
      errors: [`turns[0].reply.embeds[0].chart.chart: expected "bar" or "line"`],
    },
    {
      name: "tool call with a non-boolean ok",
      doc: {
        ...validBase,
        turns: [
          {
            id: "t1",
            request: { text: "a" },
            reply: {
              text: "a",
              tools: [{ name: "evaluate", ok: "yes", summary: "ran" }],
              embeds: [],
            },
          },
        ],
      },
      errors: ["turns[0].reply.tools[0].ok: expected a boolean"],
    },
    {
      name: "reports several problems at once",
      doc: { ...validBase, title: 1, createdUtc: 2 },
      errors: ["title: expected a string", "createdUtc: expected a string"],
    },
  ];

  it.each(cases)("$name", ({ doc, errors }) => {
    const result = parseNotebook(JSON.stringify(doc));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(errors);
  });
});
