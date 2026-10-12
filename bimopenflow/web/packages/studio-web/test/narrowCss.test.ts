// TKT-256: the stylesheet that stacks the editor's columns below 900 px must
// cover both editor looks and be loaded by the module every editor page imports.
// jsdom has no layout engine, so the rules are checked as text.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const css = readFileSync(join(src, "narrow.css"), "utf8");

describe("narrow.css", () => {
  it("stacks to one column under 900px for both looks", () => {
    expect(css).toMatch(/@media \(max-width: 900px\)/);
    for (const sel of [".bof-app-main", ".bof-studio-main"]) expect(css).toContain(sel);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) !important/);
  });
  it("hides the sidebar and splitters and stops page-level horizontal scroll", () => {
    expect(css).toMatch(/\.bof-studio-left[\s\S]*display: none !important/);
    expect(css).toMatch(/overflow-x: hidden/);
  });
  it("is imported by toolkitPanes, which every editor page loads", () => {
    expect(readFileSync(join(src, "toolkitPanes.ts"), "utf8")).toContain('import "./narrow.css"');
  });
});
