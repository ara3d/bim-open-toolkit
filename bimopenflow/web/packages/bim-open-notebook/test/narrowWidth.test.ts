import { describe, expect, it } from "vitest";
import { notebookCss } from "../src/page/styles";

// The shell is a flex column, and an auto-margined flex item sizes to its
// content. Without an explicit width the column grew to its widest unbreakable
// child (949 px) and the page scrolled sideways in narrower windows.
describe("notebook column at narrow widths", () => {
  it("takes the window's width up to its maximum", () => {
    const rule = /\.nb-column \{([^}]*)\}/.exec(notebookCss)?.[1] ?? "";
    expect(rule).toMatch(/width:\s*100%/);
    expect(rule).toMatch(/max-width:\s*var\(--nb-column-width\)/);
  });
});
