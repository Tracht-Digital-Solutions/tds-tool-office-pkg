/**
 * Helpers shared by this pack's islands. Imported relatively — that is fine
 * *inside* a pack; only the `component` entry of a tool manifest has to be a
 * package subpath.
 *
 * See the tools-site convention: labels are translated, logic is not.
 */
import { downloadBytes } from "@tracht-digital-solutions/tds-shared/download";

export type Lang = "de" | "en";

/**
 * Downloads go through tds-shared (`./download`): the link is attached, and
 * the object URL is revoked after Firefox has read it.
 */
export { downloadBlob } from "@tracht-digital-solutions/tds-shared/download";

/** pdf-lib bytes as a `.pdf` download (the shared helper copies the view first). */
export function downloadPdf(bytes: Uint8Array, name: string): void {
  downloadBytes(bytes, "application/pdf", name);
}

export const LOCALE: Record<Lang, string> = { de: "de-DE", en: "en-GB" };

/** Millimetres → PDF points (72 dpi). Sheet geometry is authored in mm here. */
export function mm(value: number): number {
  return (value * 72) / 25.4;
}

/** A4 in millimetres — every sheet this pack produces is A4. */
export const A4 = { w: 210, h: 297 } as const;

/**
 * The 14 standard PDF fonts are encoded WinAnsi, which covers German but not a
 * typographic dash pasted out of Word or an emoji. An unencodable character
 * makes pdf-lib throw at draw time, which would surface as a generic failure for
 * what is really one bad character — so they are folded down here instead.
 */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^ -ÿ\n]/g, "");
}

/** "08:30" → 510 minutes. Returns null for anything that is not a time. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m || !m[1] || !m[2]) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Worked minutes for one day. An end time before the start time is read as a
 * shift running past midnight rather than as a negative day — a late shift is
 * ordinary in the trades this is built for, and a negative total would quietly
 * corrupt the month.
 */
export function workedMinutes(start: string, end: string, breakMinutes: number): number {
  const from = parseTime(start);
  const to = parseTime(end);
  if (from === null || to === null) return 0;
  const span = to >= from ? to - from : to + 24 * 60 - from;
  return Math.max(0, span - Math.max(0, breakMinutes));
}

/** 510 → "8:30". Minutes are the unit everywhere; hours are only for display. */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
