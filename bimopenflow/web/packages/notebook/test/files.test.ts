// The page's file helpers: the sample route and the names it accepts.

import { describe, expect, it } from "vitest";
import { fetchSample } from "../src/page/files";

function recordingFetch() {
  const urls: string[] = [];
  const fetchFn = (async (url: string) => {
    urls.push(url);
    return new Response("{}");
  }) as unknown as typeof fetch;
  return { urls, fetchFn };
}

describe("fetchSample", () => {
  it("adds the notebook extension when the name leaves it out", async () => {
    const { urls, fetchFn } = recordingFetch();
    await fetchSample("s07-own-data", fetchFn);
    await fetchSample("s07-own-data.notebook.json", fetchFn);
    expect(urls).toEqual(["/__notebooks/s07-own-data.notebook.json", "/__notebooks/s07-own-data.notebook.json"]);
  });
});
