// Where the page runs: under the dev server, which serves the sample routes
// and proxies /api to a host (vite.config.ts), or as the static site built by
// vite.pages.config.ts, which holds the samples as files (sitePaths.ts) and
// has no host.

/** True in the static build (`vite build --mode pages`); Vite replaces MODE at build time. */
export const HOSTLESS = import.meta.env.MODE === "pages";

/** What the static site says in place of the host banner and the request box. */
export const HOSTLESS_NOTE =
  "This is a static copy with no host behind it, so it shows every answer as it was recorded. " +
  "Asking, Re-evaluate, and the live 3D view need a running host; the BIM Open Notebook README says how to start one.";
