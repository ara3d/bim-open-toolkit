import { describe, expect, it } from "vitest";
import type { View3dEmbed } from "../src/document/format";
import type { EmbedContext, EmbedRenderer } from "../src/embeds/contract";
import { defaultRenderers, renderEmbed, withRenderers } from "../src/embeds/registry";

const ctx = {} as EmbedContext;
const view3d = (caption?: string): View3dEmbed => ({ id: "e1", kind: "view3d", source: { analysisId: "a", nodeId: "n", port: "view" }, caption });

describe("embed registry", () => {
  it("has no 3D renderer by default", () => {
    expect(defaultRenderers.view3d).toBeUndefined();
  });

  it("draws a view3d embed's caption when no renderer is registered", async () => {
    const el = document.createElement("div");
    const handle = renderEmbed(el, view3d("Doors by width"), ctx, defaultRenderers);
    expect(el.querySelector("figcaption")?.textContent).toBe("Doors by width");
    expect(await handle.refresh()).toEqual({ state: "snapshot" });
    handle.destroy();
    expect(el.children).toHaveLength(0);
  });

  it("names the kind when the embed has no caption", () => {
    const el = document.createElement("div");
    renderEmbed(el, view3d(), ctx, defaultRenderers);
    expect(el.textContent).toContain("view3d");
  });

  it("withRenderers adds a renderer and leaves the base untouched", () => {
    const extra: EmbedRenderer<View3dEmbed> = (el) => {
      el.textContent = "drawn";
      return { refresh: async () => ({ state: "current" }), destroy: () => undefined };
    };
    const registry = withRenderers(defaultRenderers, { view3d: extra });
    const el = document.createElement("div");
    renderEmbed(el, view3d("x"), ctx, registry);
    expect(el.textContent).toBe("drawn");
    expect(defaultRenderers.view3d).toBeUndefined();
    expect(registry.table).toBe(defaultRenderers.table);
  });
});
