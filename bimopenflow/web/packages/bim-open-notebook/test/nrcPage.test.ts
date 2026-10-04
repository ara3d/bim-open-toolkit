// The NRC landing page's DOM: notebook cards link to notebook.html, graph rows
// link to the editor (and the 3D page for colouring graphs), the seeded dots
// follow the host, and problems are shown.

import { describe, expect, it } from "vitest";
import type { NotebookEntry } from "../src/page/catalog";
import type { GraphEntry } from "../src/page/nrcCatalog";
import { renderNrcPage } from "../src/page/nrcView";

const links = {
  notebook: (name: string) => `notebook.html?notebook=${name}`,
  editor: (id: string) => `editor/?analysis=${id}`,
  viewer3d: (id: string) => `editor/3d.html?analysis=${id}`,
};

const graphs: GraphEntry[] = [
  { id: "nrc-q1-building-total", answers: "total operational carbon", profiles: "tables, bim", viewer3d: false },
  { id: "nrc-dc-w1-verdicts", answers: "rule DC-W1 over doors", profiles: "bim only (view3d.color)", viewer3d: true },
];

describe("renderNrcPage", () => {
  const notebooks: NotebookEntry[] = [
    { name: "nrc-door-check", title: "Door compliance", profile: "bim", turns: 2, firstRequest: "Check DC-W1", reconstructed: false },
  ];

  it("links each notebook to notebook.html and each graph to the editor, with 3D for the colouring graphs", () => {
    const root = document.createElement("div");
    document.body.append(root);
    renderNrcPage(root, { notebooks, graphs, seeded: new Set(["nrc-q1-building-total"]), problems: [] }, links);
    const card = root.querySelector<HTMLAnchorElement>("a[data-notebook='nrc-door-check']")!;
    expect(card.getAttribute("href")).toBe("notebook.html?notebook=nrc-door-check");
    expect(card.textContent).toContain("Door compliance");
    expect(card.textContent).toContain("2 turns");
    const q1 = root.querySelector("tr[data-analysis='nrc-q1-building-total']")!;
    expect([...q1.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["editor/?analysis=nrc-q1-building-total"]);
    expect(q1.querySelector(".nrc-dot.is-seeded")).not.toBeNull();
    const doors = root.querySelector("tr[data-analysis='nrc-dc-w1-verdicts']")!;
    expect([...doors.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["graph", "3D"]);
    expect(doors.querySelector(".nrc-dot.is-seeded")).toBeNull();
  });

  it("shows no seeded dots when the host is unknown, and lists problems", () => {
    const root = document.createElement("div");
    renderNrcPage(root, { notebooks: [], graphs, problems: ["The graph list could not be read"] }, links);
    expect(root.querySelector(".nrc-dot")).toBeNull();
    expect(root.querySelector(".nrc-problem")?.textContent).toBe("The graph list could not be read");
  });
});
