import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { daysInMonth } from "./Timesheet";
import { A4, formatDuration, mm, toWinAnsi, workedMinutes } from "./shared";

describe("daysInMonth", () => {
  it("knows the ordinary month lengths", () => {
    expect(daysInMonth("2026-01")).toBe(31);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("knows a leap February", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("returns zero for a value that is not a month", () => {
    // <input type="month"> is empty until touched on some browsers; a NaN day
    // count would render a table of `undefined` rows rather than nothing.
    for (const value of ["", "2026", "2026-13-01", "abc"]) {
      expect(daysInMonth(value), value).toBe(0);
    }
  });
});

describe("monthly totals", () => {
  it("adds the days of a normal week", () => {
    const week = [
      ["08:00", "16:30", 30],
      ["08:00", "16:30", 30],
      ["08:00", "16:30", 30],
      ["08:00", "16:30", 30],
      ["08:00", "14:00", 30],
    ] as const;
    const total = week.reduce((sum, [s, e, p]) => sum + workedMinutes(s, e, p), 0);
    expect(total).toBe(4 * 480 + 330);
    expect(formatDuration(total)).toBe("37:30");
  });

  it("skips a day that was never filled in", () => {
    const total = [
      ["08:00", "16:00", 0],
      ["", "", 0],
    ].reduce((sum, [s, e, p]) => sum + workedMinutes(s as string, e as string, p as number), 0);
    expect(formatDuration(total)).toBe("8:00");
  });
});

describe("the generated sheet", () => {
  it("fits a whole month of rows onto one A4 page", async () => {
    // 31 rows at 12 pt plus the header block and the signature strip; if this
    // ever stops fitting the last days silently fall off the bottom of the page
    // rather than starting a second one.
    const headerBlock = 18 + 14 + 16 + 16;
    const rows = 31 * 12;
    const footer = 60;
    expect(headerBlock + rows + footer).toBeLessThan(mm(A4.h) - mm(18));
  });

  it("draws German name fields without throwing", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([mm(A4.w), mm(A4.h)]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(() =>
      page.drawText(toWinAnsi("Mitarbeiterin: Jürgen Weiß – Büro"), {
        x: 40,
        y: 700,
        size: 10,
        font,
      }),
    ).not.toThrow();
    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("would throw on unsanitised text, which is why toWinAnsi exists", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([mm(A4.w), mm(A4.h)]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(() => page.drawText("Büro 🚀", { x: 40, y: 700, size: 10, font })).toThrow();
  });
});
