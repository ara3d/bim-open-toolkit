// The NRC half of what the NRC landing page (nrc.html) lists: the notebooks
// that lead it, and the graphs in samples/nrc-analyses. The notebook entries
// themselves are catalog.ts's. The graph list is read from that folder's
// README table, so the README stays the one place a graph's one-line
// description lives. Pure functions; nrc.ts fetches.

/** The three recorded NRC notebooks lead the landing page, in reading order; the reconstructed sessions follow by name. */
export const NRC_LEAD = ["nrc-eight-questions", "nrc-test-kit", "nrc-door-check"] as const;

/** One row of the README table in samples/nrc-analyses. */
export interface GraphEntry {
  /** The analysis id, the value of `?analysis=`. */
  readonly id: string;
  /** The "Answers" column, code spans dropped. */
  readonly answers: string;
  /** The "Runs in profile" column, e.g. "tables, bim" or "bim only (view3d.color)". */
  readonly profiles: string;
  /** True when the graph ends in a 3D view, so the 3D page is the better link. */
  readonly viewer3d: boolean;
}

/** Splits one markdown table row into trimmed cells. */
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

const dropCodeSpans = (cell: string): string => cell.replace(/`/g, "");

/**
 * The rows of the README's first table whose header cell is "Graph": one entry
 * per graph, in the README's order. Empty when there is no such table.
 */
export function parseGraphTable(readme: string): GraphEntry[] {
  const lines = readme.split("\n");
  const header = lines.findIndex((l) => /^\|\s*Graph\s*\|/.test(l));
  if (header < 0) return [];
  const rows: GraphEntry[] = [];
  for (let i = header + 2; i < lines.length && lines[i]!.startsWith("|"); i++) {
    const [id = "", answers = "", profiles = ""] = cells(lines[i]!);
    rows.push({
      id: dropCodeSpans(id),
      answers: dropCodeSpans(answers),
      profiles: dropCodeSpans(profiles),
      viewer3d: /view3d\./.test(profiles),
    });
  }
  return rows;
}
