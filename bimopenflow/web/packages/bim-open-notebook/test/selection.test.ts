import { describe, expect, it } from "vitest";
import { createSelectionBus } from "../src/embeds/selection";

describe("selection bus", () => {
  it("tells every listener the ids and who published them", () => {
    const bus = createSelectionBus();
    const heard: string[] = [];
    bus.subscribe((ids, origin) => heard.push(`${origin}:${ids.join(",")}`));
    bus.publish(["a", "b"], "table-1");
    expect(heard).toEqual(["table-1:a,b"]);
    expect(bus.current()).toEqual(["a", "b"]);
  });

  it("stops telling a listener after it unsubscribes", () => {
    const bus = createSelectionBus();
    let calls = 0;
    const stop = bus.subscribe(() => calls++);
    stop();
    bus.publish(["a"], "x");
    expect(calls).toBe(0);
  });
});
