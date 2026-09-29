// Links from a notebook page into the editor: the graph page and the 3D page
// of packages/app, both of which open the analysis named by ?analysis=<id>.

/** Base URL of the editor page; the tables profile of scripts/start-bim-flow.mjs by default. */
const EDITOR_BASE =
  (import.meta.env.VITE_BOF_EDITOR as string | undefined) ?? "http://127.0.0.1:5310/";

const base = (): string => (EDITOR_BASE.endsWith("/") ? EDITOR_BASE : `${EDITOR_BASE}/`);

/** The editor with `analysisId` open on the canvas. */
export const editorUrl = (analysisId: string): string =>
  `${base()}?analysis=${encodeURIComponent(analysisId)}`;

/** The 3D-first page (3d.html) with `analysisId` open. */
export const viewer3dUrl = (analysisId: string): string =>
  `${base()}3d.html?analysis=${encodeURIComponent(analysisId)}`;
