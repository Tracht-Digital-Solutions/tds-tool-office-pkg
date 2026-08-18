import { describe, expect, it } from "vitest";
import { A4, formatDuration, mm, parseTime, toWinAnsi, workedMinutes } from "./shared";

describe("mm", () => {
  it("converts millimetres to PDF points at 72 dpi", () => {
    expect(mm(25.4)).toBeCloseTo(72, 6);
    expect(mm(0)).toBe(0);
  });

  it("gives A4 its expected point size", () => {
    expect(mm(A4.w)).toBeCloseTo(595.28, 1);
    expect(mm(A4.h)).toBeCloseTo(841.89, 1);
  });
});

describe("parseTime", () => {
  it("reads a 24-hour time into minutes", () => {
    expect(parseTime("08:30")).toBe(510);
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("23:59")).toBe(1439);
  });

  it("tolerates a single-digit hour and surrounding space", () => {
    expect(parseTime(" 8:05 ")).toBe(485);
  });

  it("rejects an impossible or malformed time", () => {
    for (const value of ["", "8", "24:00", "12:60", "8.30", "abc"]) {
      expect(parseTime(value), value).toBeNull();
    }
  });
});

describe("workedMinutes", () => {
  it("subtracts the break from the span", () => {
    expect(workedMinutes("08:00", "16:30", 30)).toBe(480);
  });

  it("reads an end before the start as a shift past midnight", () => {
    // A late shift is ordinary in the trades this is built for; treating it as
    // a negative day would quietly corrupt the monthly total instead.
    expect(workedMinutes("22:00", "06:00", 0)).toBe(480);
  });

  it("never returns a negative day", () => {
    expect(workedMinutes("08:00", "08:30", 120)).toBe(0);
  });

  it("counts an incomplete row as zero rather than guessing", () => {
    expect(workedMinutes("", "16:30", 0)).toBe(0);
    expect(workedMinutes("08:00", "", 0)).toBe(0);
  });

  it("ignores a negative break", () => {
    expect(workedMinutes("08:00", "09:00", -60)).toBe(60);
  });
});

describe("formatDuration", () => {
  it("renders minutes as hours and minutes", () => {
    expect(formatDuration(510)).toBe("8:30");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(5)).toBe("0:05");
  });

  it("keeps hours past 24 as hours, not as days", () => {
    expect(formatDuration(1500)).toBe("25:00");
  });

  it("marks a negative duration with a sign", () => {
    expect(formatDuration(-90)).toBe("-1:30");
  });
});

describe("toWinAnsi", () => {
  it("keeps German text intact", () => {
    expect(toWinAnsi("Grüße aus Schwarzenbek")).toBe("Grüße aus Schwarzenbek");
  });

  it("keeps line breaks, because an address has several lines", () => {
    expect(toWinAnsi("Musterfirma\nHauptstraße 1")).toBe("Musterfirma\nHauptstraße 1");
  });

  it("folds typographic punctuation and drops unencodable characters", () => {
    expect(toWinAnsi("„Test“ – ok 🚀")).toBe('"Test" - ok ');
  });
});
