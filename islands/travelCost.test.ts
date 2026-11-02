import { describe, expect, it, vi } from "vitest";
import { ORIGIN, estimateRoute, findPlace, findRoute, straightLineKm, travelCost } from "./travelCost";

const hamburg = { lat: 53.5511, lon: 9.9937, label: "Hamburg" };
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

describe("travel cost", () => {
  it("measures the straight line", () => {
    expect(straightLineKm(ORIGIN, hamburg)).toBeGreaterThan(30);
    expect(straightLineKm(ORIGIN, hamburg)).toBeLessThan(35);
  });

  it("charges both ways on request", () => {
    expect(travelCost(40, 0.3, false)).toEqual({ chargedKm: 40, cost: 12 });
    expect(travelCost(40, 0.3, true)).toEqual({ chargedKm: 80, cost: 24 });
  });

  it("rounds to the cent", () => {
    expect(travelCost(33.333, 0.3, false).cost).toBe(10);
  });
});

describe("the services", () => {
  it("reads a place and reports none", async () => {
    const found = vi.fn(() => json([{ lat: "53.55", lon: "9.99", display_name: "Hamburg" }]));
    expect(await findPlace("Hamburg", "de", found as never)).toEqual({ lat: 53.55, lon: 9.99, label: "Hamburg" });
    expect(await findPlace("xyz", "de", (() => json([])) as never)).toBeNull();
  });

  it("reads a route", async () => {
    const route = await findRoute(hamburg, (() => json({ routes: [{ distance: 42000, duration: 2400 }] })) as never);
    expect(route).toEqual({ km: 42, minutes: 40, estimated: false });
  });

  it("falls back to a labelled estimate when the router fails", async () => {
    const route = await findRoute(hamburg, (() => json({}, false)) as never);
    expect(route).toEqual(estimateRoute(hamburg));
    expect(route.estimated).toBe(true);
  });
});
