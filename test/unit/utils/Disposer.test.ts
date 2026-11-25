import { describe, expect, it } from "vitest";
import { Disposer } from "../../../src/utils/Disposer.js";

describe("Disposer", () => {
  it("runs steps newest first", async () => {
    const order: number[] = [];
    const disposer = new Disposer();
    disposer.add(() => {
      order.push(1);
    });
    disposer.add(async () => {
      await Promise.resolve();
      order.push(2);
    });
    disposer.add(() => {
      order.push(3);
    });
    expect(await disposer.dispose()).toEqual([]);
    expect(order).toEqual([3, 2, 1]);
  });

  it("keeps going when a step throws, and reports the error", async () => {
    const ran: string[] = [];
    const failure = new Error("boom");
    const disposer = new Disposer();
    disposer.add(() => {
      ran.push("first");
    });
    disposer.add(() => {
      throw failure;
    });
    const errors = await disposer.dispose();
    expect(errors).toEqual([failure]);
    expect(ran).toEqual(["first"]);
  });

  it("only disposes once", async () => {
    let calls = 0;
    const disposer = new Disposer();
    disposer.add(() => {
      calls += 1;
    });
    await disposer.dispose();
    await disposer.dispose();
    expect(calls).toBe(1);
    expect(disposer.disposed).toBe(true);
  });

  it("runs late steps right away", async () => {
    const disposer = new Disposer();
    await disposer.dispose();
    let ran = false;
    disposer.add(() => {
      ran = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(ran).toBe(true);
  });
});
