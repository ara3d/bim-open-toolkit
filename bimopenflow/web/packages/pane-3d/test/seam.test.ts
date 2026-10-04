// @vitest-environment node
// The seam of this package (rules in ./seam.ts): no import of the toolkit's
// editor application or pages, no toolkit sample named, and nothing from the
// notebook package, which builds on this pane and never the other way round.

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { seamOffences } from "./seam";

const packageDir = fileURLToPath(new URL("..", import.meta.url));

describe("seam", () => {
  it("reaches nothing of the toolkit and nothing of the notebook", () => {
    const offences = seamOffences(packageDir, {
      alsoForbidden: [/bim-open-notebook/],
      exempt: ["test/seam.ts", "test/seam.test.ts"],
    });
    expect(offences).toEqual([]);
  });
});
