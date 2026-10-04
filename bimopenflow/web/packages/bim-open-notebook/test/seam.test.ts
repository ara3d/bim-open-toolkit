// @vitest-environment node
// The seam of the notebook package: no import of the toolkit's editor
// application or pages, and no toolkit sample named anywhere in the package,
// so it builds alone in ara3d/bim-open-notebook. The rules are shared with the
// 3D pane, which moves with it: ../../pane-3d/test/seam.ts.

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { seamOffences } from "../../pane-3d/test/seam";

const packageDir = fileURLToPath(new URL("..", import.meta.url));

describe("seam", () => {
  it("reaches nothing of the toolkit", () => {
    expect(seamOffences(packageDir, { exempt: ["test/seam.test.ts"] })).toEqual([]);
  });
});
