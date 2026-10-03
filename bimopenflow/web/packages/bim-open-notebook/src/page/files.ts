// Browser-file helpers for the notebook page: the committed samples, served by
// the dev server (vite.config.ts, /__notebooks/) or held as files by the static
// site (vite.pages.config.ts, notebooks/), reading a picked file, and
// downloading text. Each is a small function a test can drive with fakes.

import { NOTEBOOK_EXTENSION } from "../document/format";
import { HOSTLESS } from "./site";
import { STATIC_INDEX, STATIC_SAMPLES } from "./sitePaths";

/** Where the committed sample notebooks are: the dev server's route, or the static site's folder. */
export const SAMPLES_ROUTE = HOSTLESS ? STATIC_SAMPLES : "/__notebooks/";

/** The URL that lists the samples' file names: the route itself in dev, an index file when static. */
const SAMPLES_LIST = HOSTLESS ? `${STATIC_SAMPLES}${STATIC_INDEX}` : SAMPLES_ROUTE;

/** The sample notebooks' file names, sorted as the server sends them. */
export async function listSamples(fetchFn: typeof fetch = globalThis.fetch): Promise<string[]> {
  const response = await fetchFn(SAMPLES_LIST);
  if (!response.ok) throw new Error(`GET ${SAMPLES_LIST} -> ${response.status}`);
  const names: unknown = await response.json();
  if (!Array.isArray(names) || !names.every((n) => typeof n === "string"))
    throw new Error(`GET ${SAMPLES_LIST} did not answer a list of names`);
  return names;
}

/** One sample notebook's text, unparsed; `name` may leave out the `.notebook.json` extension. */
export async function fetchSample(name: string, fetchFn: typeof fetch = globalThis.fetch): Promise<string> {
  const file = name.endsWith(NOTEBOOK_EXTENSION) ? name : `${name}${NOTEBOOK_EXTENSION}`;
  const url = `${SAMPLES_ROUTE}${encodeURIComponent(file)}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return response.text();
}

/** A file's contents as UTF-8 text. FileReader rather than Blob.text(), which jsdom lacks. */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsText(file);
  });
}

/** "Door schedule, level 2" -> "door-schedule-level-2.notebook.json"; "notebook" when nothing is left. */
export function notebookFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "notebook"}${NOTEBOOK_EXTENSION}`;
}

/** Offers `text` to the browser as a download named `fileName`. */
export function downloadText(doc: Document, fileName: string, text: string, mediaType = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mediaType }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
