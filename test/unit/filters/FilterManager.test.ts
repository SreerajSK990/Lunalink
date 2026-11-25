import { describe, expect, it, vi } from "vitest";
import { CapabilitySet } from "../../../src/capabilities/CapabilitySet.js";
import { ErrorCode } from "../../../src/errors/ErrorCode.js";
import { FilterManager } from "../../../src/filters/FilterManager.js";
import type { ApiFilters } from "../../../src/protocol/index.js";

function setup(
  filters: string[] = ["timescale", "rotation", "equalizer", "lowPass", "echo", "high-pass"],
) {
  const sent: ApiFilters[] = [];
  const manager = new FilterManager({
    capabilities: () =>
      new CapabilitySet(
        "main",
        filters.map((name) => `filter:${name}`),
      ),
    nodeId: () => "main",
    send: vi.fn((value: ApiFilters) => {
      sent.push(value);
      return Promise.resolve();
    }),
    extraPresets: () => [
      { name: "custom", description: "test", filters: { rotation: { rotationHz: 1 } } },
    ],
  });
  return { manager, sent };
}

describe("FilterManager", () => {
  it("keeps earlier filters when setting new ones and always sends everything", async () => {
    const { manager, sent } = setup();
    await manager.set({ timescale: { speed: 1.2 } });
    await manager.set({ rotation: { rotationHz: 0.2 } });
    expect(sent.at(-1)).toEqual({ timescale: { speed: 1.2 }, rotation: { rotationHz: 0.2 } });
  });

  it("removes a filter set to null and clears by name", async () => {
    const { manager, sent } = setup();
    await manager.set({ timescale: { speed: 1.2 }, rotation: { rotationHz: 0.2 } });
    await manager.set({ timescale: null });
    expect(sent.at(-1)).toEqual({ rotation: { rotationHz: 0.2 } });
    await manager.clear("rotation");
    expect(sent.at(-1)).toEqual({});
  });

  it("merges and clears plugin filters separately", async () => {
    const { manager, sent } = setup();
    await manager.set({ pluginFilters: { "high-pass": { cutoffFrequency: 80, boostFactor: 1 } } });
    await manager.set({ rotation: { rotationHz: 0.2 } });
    expect(manager.active()).toEqual(["rotation", "high-pass"]);
    await manager.clear("high-pass");
    expect(sent.at(-1)).toEqual({ rotation: { rotationHz: 0.2 } });
  });

  it("applies and toggles presets", async () => {
    const { manager } = setup();
    expect(await manager.toggle("nightcore")).toBe(true);
    expect(manager.isPresetActive("nightcore")).toBe(true);
    expect(await manager.toggle("nightcore")).toBe(false);
    expect(manager.state).toEqual({});
    await manager.preset("custom");
    expect(manager.state.rotation).toEqual({ rotationHz: 1 });
  });

  it("merges equalizer bands", async () => {
    const { manager } = setup();
    await manager.setEqualizer([{ band: 0, gain: 0.2 }]);
    await manager.setEqualizer([
      { band: 3, gain: 0.1 },
      { band: 0, gain: 0.3 },
    ]);
    expect(manager.state.equalizer).toEqual([
      { band: 0, gain: 0.3 },
      { band: 3, gain: 0.1 },
    ]);
  });

  it("rejects out of range values before sending", async () => {
    const { manager, sent } = setup();
    await expect(manager.set({ equalizer: [{ band: 20, gain: 0 }] })).rejects.toMatchObject({
      code: ErrorCode.InvalidArgument,
    });
    expect(sent).toHaveLength(0);
  });

  it("refuses filters the node doesn't list, matching names case-insensitively", async () => {
    const { manager } = setup(["timescale", "lowpass"]);
    await manager.set({ lowPass: { smoothing: 20 } });
    await expect(manager.set({ reverb: { roomSize: 0.5 } })).rejects.toMatchObject({
      code: ErrorCode.UnsupportedFeature,
    });
  });

  it("names the presets when one isn't found", async () => {
    const { manager } = setup();
    await expect(manager.preset("nope")).rejects.toThrow(/nightcore/);
  });
});
