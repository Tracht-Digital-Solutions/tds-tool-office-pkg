import { describe, expect, it } from "vitest";
import { PRESETS, splitLabels } from "./LabelSheet";
import { A4 } from "./shared";

describe("splitLabels", () => {
  it("keeps a multi-line address as one label", () => {
    expect(splitLabels("Musterfirma GmbH\nHauptstraße 1\n21493 Schwarzenbek")).toEqual([
      ["Musterfirma GmbH", "Hauptstraße 1", "21493 Schwarzenbek"],
    ]);
  });

  it("ends a label at a blank line", () => {
    expect(splitLabels("Eins\nZwei\n\nDrei")).toEqual([["Eins", "Zwei"], ["Drei"]]);
  });

  it("survives Windows line endings", () => {
    // The most likely input is a block pasted out of Word or Outlook.
    expect(splitLabels("Eins\r\n\r\nZwei")).toEqual([["Eins"], ["Zwei"]]);
  });

  it("ignores trailing blank lines instead of producing empty stickers", () => {
    expect(splitLabels("Eins\n\n\n\n")).toEqual([["Eins"]]);
    expect(splitLabels("   \n\n  ")).toEqual([]);
  });

  it("trims each line", () => {
    expect(splitLabels("  Eins  \n  Zwei ")).toEqual([["Eins", "Zwei"]]);
  });
});

describe("label presets", () => {
  it("has a unique key per preset", () => {
    const keys = PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("fits every grid onto an A4 sheet", () => {
    // A grid wider or taller than the sheet prints stickers that fall off the
    // edge — and the PDF looks perfectly fine until it comes out of the printer.
    for (const p of PRESETS) {
      const width = p.marginLeft * 2 + p.cols * p.width + (p.cols - 1) * p.gapX;
      const height = p.marginTop * 2 + p.rows * p.height + (p.rows - 1) * p.gapY;
      expect(width, `${p.key} width`).toBeLessThanOrEqual(A4.w + 0.01);
      expect(height, `${p.key} height`).toBeLessThanOrEqual(A4.h + 0.01);
    }
  });

  it("states a label count in its own name that matches the grid", () => {
    for (const p of PRESETS) {
      const stated = Number(p.label.split(" ")[0]);
      expect(stated, `${p.key} label`).toBe(p.cols * p.rows);
    }
  });

  it("uses positive geometry throughout", () => {
    for (const p of PRESETS) {
      expect(p.cols).toBeGreaterThan(0);
      expect(p.rows).toBeGreaterThan(0);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.marginLeft).toBeGreaterThanOrEqual(0);
      expect(p.marginTop).toBeGreaterThanOrEqual(0);
    }
  });
});
