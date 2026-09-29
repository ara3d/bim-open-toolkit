// The NRC landing page's DOM: a heading, the notebook cards, and the graph
// table. Pure rendering from nrcCatalog's entries; nrc.ts supplies them and
// the links. Themed by the "nb-" custom properties of styles.ts.

import type { GraphEntry, NotebookEntry } from "./nrcCatalog";

export interface NrcPageLinks {
  /** notebook.html with the sample open. */
  readonly notebook: (name: string) => string;
  /** The editor with the analysis open. */
  readonly editor: (id: string) => string;
  /** The 3D page with the analysis open. */
  readonly viewer3d: (id: string) => string;
}

export interface NrcPageData {
  readonly notebooks: readonly NotebookEntry[];
  readonly graphs: readonly GraphEntry[];
  /** Ids the connected host has in its store; undefined while unknown or offline. */
  readonly seeded?: ReadonlySet<string>;
  /** Anything that kept a list from loading, shown above the lists. */
  readonly problems: readonly string[];
}

export const nrcCss = `
.nrc-page { max-width: var(--nb-column-width); margin: 0 auto; padding: 24px 16px 48px; }
.nrc-page h1 { font-size: 24px; margin: 0 0 4px; }
.nrc-page h2 { font-size: 18px; margin: 32px 0 8px; }
.nrc-lede { color: var(--nb-dim); margin: 0 0 8px; line-height: 1.5; max-width: 80ch; }
.nrc-page a { color: var(--nb-accent); }
.nrc-problem { color: var(--nb-red); margin: 8px 0; }
.nrc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin: 12px 0; }
.nrc-card {
  display: block; padding: 12px 14px; border: 1px solid var(--nb-border); border-radius: 8px;
  background: var(--nb-surface); color: inherit; text-decoration: none;
}
.nrc-card:hover, .nrc-card:focus { border-color: var(--nb-accent); }
.nrc-card-title { font-weight: 600; margin-bottom: 4px; }
.nrc-card-request { font-size: 13px; line-height: 1.45; margin: 0 0 6px; }
.nrc-meta { font-size: 12px; color: var(--nb-dim); }
.nrc-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
.nrc-table th, .nrc-table td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--nb-border); }
.nrc-table th { font-weight: 600; color: var(--nb-dim); }
.nrc-table code { font: 12px ui-monospace, Consolas, monospace; }
.nrc-open { white-space: nowrap; }
.nrc-open a + a { margin-left: 8px; }
.nrc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: var(--nb-border); vertical-align: middle; }
.nrc-dot.is-seeded { background: var(--nb-green); }
`;

const STYLE_ID = "nrc-styles";

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = nrcCss;
  doc.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(doc: Document, href: string, text: string, className?: string): HTMLAnchorElement {
  const a = el(doc, "a", className, text);
  a.href = href;
  return a;
}

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

function notebookCard(doc: Document, entry: NotebookEntry, links: NrcPageLinks): HTMLElement {
  const card = link(doc, links.notebook(entry.name), "", "nrc-card");
  card.dataset.notebook = entry.name;
  card.append(el(doc, "div", "nrc-card-title", entry.title));
  if (entry.firstRequest) card.append(el(doc, "p", "nrc-card-request", `“${entry.firstRequest}”`));
  const meta = [plural(entry.turns, "turn")];
  if (entry.profile) meta.push(`${entry.profile} host`);
  if (entry.reconstructed) meta.push("reconstructed session");
  card.append(el(doc, "div", "nrc-meta", meta.join(" · ")));
  return card;
}

function graphRow(doc: Document, entry: GraphEntry, links: NrcPageLinks, seeded?: ReadonlySet<string>): HTMLElement {
  const tr = el(doc, "tr");
  tr.dataset.analysis = entry.id;
  const idCell = el(doc, "td");
  if (seeded) {
    const has = seeded.has(entry.id);
    const dot = el(doc, "span", `nrc-dot${has ? " is-seeded" : ""}`);
    dot.title = has ? "In the connected host's store" : "Not in the connected host's store";
    idCell.append(dot);
  }
  idCell.append(el(doc, "code", undefined, entry.id));
  tr.append(idCell, el(doc, "td", undefined, entry.answers), el(doc, "td", undefined, entry.profiles));
  const open = el(doc, "td", "nrc-open");
  open.append(link(doc, links.editor(entry.id), "graph"));
  if (entry.viewer3d) open.append(link(doc, links.viewer3d(entry.id), "3D"));
  tr.append(open);
  return tr;
}

const LEDE =
  "The demonstration behind the NRC paper Storing, Displaying, and Querying Building Analytics on IFC Models: " +
  "synthetic analytics written into the buildingSMART Duplex model as property sets, then read back, charted, " +
  "coloured onto the geometry, and questioned in plain language. Two ways in: notebooks that record a session " +
  "with the agent, and the graphs those sessions ran.";

const NOTEBOOKS_LEDE =
  "Each notebook is a request-and-reply transcript with the values, tables, charts, graphs, and 3D views the host " +
  "computed. It opens with no host; with one connected, every embed can be re-evaluated. A notebook names the " +
  "host profile its graphs need.";

const GRAPHS_LEDE =
  "The graphs in samples/nrc-analyses, seeded into every fresh host; every one ends in a node named answer. " +
  "“graph” opens it in the editor, “3D” the 3D page for graphs that colour the model. " +
  "A green dot marks a graph the connected host holds.";

/** Builds the page under `root`, replacing what was there. */
export function renderNrcPage(root: HTMLElement, data: NrcPageData, links: NrcPageLinks): void {
  const doc = root.ownerDocument;
  ensureStyles(doc);
  root.replaceChildren();
  const page = el(doc, "div", "nrc-page");

  page.append(el(doc, "h1", undefined, "Building analytics on IFC models"), el(doc, "p", "nrc-lede", LEDE));
  for (const problem of data.problems) page.append(el(doc, "p", "nrc-problem", problem));

  page.append(el(doc, "h2", undefined, "Notebooks"), el(doc, "p", "nrc-lede", NOTEBOOKS_LEDE));
  const cards = el(doc, "div", "nrc-cards");
  for (const entry of data.notebooks) cards.append(notebookCard(doc, entry, links));
  page.append(cards);

  page.append(el(doc, "h2", undefined, "Graphs"), el(doc, "p", "nrc-lede", GRAPHS_LEDE));
  const table = el(doc, "table", "nrc-table");
  const head = el(doc, "tr");
  for (const h of ["Graph", "Answers", "Runs in profile", "Open"]) head.append(el(doc, "th", undefined, h));
  table.append(head);
  for (const entry of data.graphs) table.append(graphRow(doc, entry, links, data.seeded));
  page.append(table);

  root.append(page);
}
