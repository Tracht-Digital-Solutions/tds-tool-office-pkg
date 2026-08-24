import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { A4, downloadPdf, mm, toWinAnsi, type Lang } from "./shared";

/** One label grid on an A4 sheet. All measurements in millimetres. */
export interface Preset {
  key: string;
  label: string;
  cols: number;
  rows: number;
  width: number;
  height: number;
  marginLeft: number;
  marginTop: number;
  gapX: number;
  gapY: number;
}

/**
 * The common German label sheets. The product codes are given as compatibility
 * hints, not as a claim about any manufacturer — what actually matters is the
 * geometry, and a sheet from any brand with the same grid fits.
 */
export const PRESETS: Preset[] = [
  {
    key: "70x37",
    label: "24 · 70 × 37 mm (3 × 8) · Avery 3475",
    cols: 3,
    rows: 8,
    width: 70,
    height: 37,
    marginLeft: 0,
    marginTop: 0.5,
    gapX: 0,
    gapY: 0,
  },
  {
    key: "635x381",
    label: "21 · 63,5 × 38,1 mm (3 × 7) · Avery L7160",
    cols: 3,
    rows: 7,
    width: 63.5,
    height: 38.1,
    marginLeft: 7.2,
    marginTop: 15.1,
    gapX: 2.5,
    gapY: 0,
  },
  {
    key: "991x381",
    label: "14 · 99,1 × 38,1 mm (2 × 7) · Avery L7163",
    cols: 2,
    rows: 7,
    width: 99.1,
    height: 38.1,
    marginLeft: 4.65,
    marginTop: 15.1,
    gapX: 2.5,
    gapY: 0,
  },
  {
    key: "105x57",
    label: "10 · 105 × 57 mm (2 × 5) · Avery 3483",
    cols: 2,
    rows: 5,
    width: 105,
    height: 57,
    marginLeft: 0,
    marginTop: 6,
    gapX: 0,
    gapY: 0,
  },
  {
    key: "525x297",
    label: "40 · 52,5 × 29,7 mm (4 × 10) · Avery 3474",
    cols: 4,
    rows: 10,
    width: 52.5,
    height: 29.7,
    marginLeft: 0,
    marginTop: 0,
    gapX: 0,
    gapY: 0,
  },
];

interface Strings {
  needText: string;
  failed: string;
  done: (labels: number, sheets: number) => string;
  outName: string;
  sheet: string;
  content: string;
  contentHint: string;
  placeholder: string;
  repeat: string;
  repeatHint: string;
  startAt: string;
  startAtHint: string;
  fontSize: string;
  align: string;
  alignLeft: string;
  alignCenter: string;
  guides: string;
  guidesHint: string;
  preview: (n: number) => string;
  working: string;
  run: string;
  note: string;
}

/** German is the default; an older pinned pack must keep working unchanged. */
const STRINGS = {
  de: {
    needText: "Bitte mindestens ein Etikett eingeben.",
    failed: "Der Etikettenbogen konnte nicht erstellt werden.",
    done: (labels, sheets) => `${labels} Etikett(en) auf ${sheets} Bogen erstellt.`,
    outName: "etiketten.pdf",
    sheet: "Bogen",
    content: "Etiketten",
    contentHint:
      "Ein Etikett je Absatz. Zeilenumbrüche innerhalb eines Absatzes werden zu Zeilen auf dem Etikett; ein Etikett endet an einer Leerzeile.",
    placeholder: "Musterfirma GmbH\nHauptstraße 1\n21493 Schwarzenbek",
    repeat: "Dasselbe Etikett auf allen Feldern",
    repeatHint: "Für Absender- oder Inventaraufkleber: der erste Absatz füllt den ganzen Bogen.",
    startAt: "Erstes benutztes Feld",
    startAtHint: "Bei einem angebrochenen Bogen: die Felder davor bleiben leer.",
    fontSize: "Schriftgröße",
    align: "Ausrichtung",
    alignLeft: "Linksbündig",
    alignCenter: "Zentriert",
    guides: "Schnittlinien andeuten",
    guidesHint: "Hilfslinien zum Prüfen der Passgenauigkeit — vor dem echten Druck abschalten.",
    preview: (n) => `${n} Etikett(en) erkannt`,
    working: "Erstelle …",
    run: "Bogen erstellen & herunterladen",
    note: "Der Bogen wird lokal im Browser erzeugt; die Adressen verlassen Ihren Rechner nicht.",
  },
  en: {
    needText: "Please enter at least one label.",
    failed: "The label sheet could not be created.",
    done: (labels, sheets) => `Created ${labels} label(s) across ${sheets} sheet(s).`,
    outName: "labels.pdf",
    sheet: "Sheet",
    content: "Labels",
    contentHint:
      "One label per paragraph. Line breaks inside a paragraph become lines on the label; a label ends at a blank line.",
    placeholder: "Example Ltd\n1 High Street\nLondon",
    repeat: "Put the same label in every slot",
    repeatHint: "For return addresses or asset stickers: the first paragraph fills the whole sheet.",
    startAt: "First slot to use",
    startAtHint: "For a partly used sheet: the slots before it are left empty.",
    fontSize: "Font size",
    align: "Alignment",
    alignLeft: "Left",
    alignCenter: "Centred",
    guides: "Show cutting guides",
    guidesHint: "Guide lines for checking the alignment — switch them off for the real print run.",
    preview: (n) => `${n} label(s) detected`,
    working: "Creating …",
    run: "Create sheet & download",
    note: "The sheet is produced locally in your browser; the addresses never leave your machine.",
  },
} satisfies Record<Lang, Strings>;

/**
 * Split the textarea into labels: a blank line ends a label, so a multi-line
 * address stays one label. Trailing blank lines are ignored rather than becoming
 * empty stickers.
 */
export function splitLabels(input: string): string[][] {
  return input
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter((line) => line !== ""))
    .filter((lines) => lines.length > 0);
}

/**
 * Premium label-sheet tool — lays addresses out on a standard A4 label grid and
 * hands back a print-ready PDF. Client-side via pdf-lib.
 */
interface Props {
  lang?: Lang;
}

export default function LabelSheet({ lang = "de" }: Props) {
  const t = STRINGS[lang];
  const [presetKey, setPresetKey] = useState(PRESETS[0]?.key ?? "70x37");
  const [text, setText] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [align, setAlign] = useState<"left" | "center">("left");
  const [guides, setGuides] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0]!;
  const perSheet = preset.cols * preset.rows;
  const parsed = splitLabels(text);

  const run = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (parsed.length === 0) throw new Error(t.needText);
      const skip = Math.min(Math.max(1, startAt), perSheet) - 1;
      const labels = repeat
        ? Array.from({ length: perSheet - skip }, () => parsed[0]!)
        : parsed;

      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const lineHeight = fontSize * 1.25;
      let page = doc.addPage([mm(A4.w), mm(A4.h)]);
      let sheets = 1;

      for (const [i, lines] of labels.entries()) {
        const slot = i + skip;
        const onSheet = slot % perSheet;
        if (i > 0 && onSheet === 0) {
          page = doc.addPage([mm(A4.w), mm(A4.h)]);
          sheets++;
        }
        const col = onSheet % preset.cols;
        const row = Math.floor(onSheet / preset.cols);
        const left = mm(preset.marginLeft + col * (preset.width + preset.gapX));
        // PDF user space has its origin bottom-left; label grids are counted
        // from the top of the sheet, so the row index is measured downwards.
        const top = mm(A4.h - preset.marginTop - row * (preset.height + preset.gapY));

        if (guides) {
          page.drawRectangle({
            x: left,
            y: top - mm(preset.height),
            width: mm(preset.width),
            height: mm(preset.height),
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
        }

        const padding = mm(3);
        const block = lines.length * lineHeight;
        const firstBaseline = top - mm(preset.height) / 2 + block / 2 - lineHeight * 0.8;
        for (const [j, raw] of lines.entries()) {
          const line = toWinAnsi(raw);
          const width = font.widthOfTextAtSize(line, fontSize);
          const x =
            align === "center"
              ? left + (mm(preset.width) - width) / 2
              : left + padding;
          page.drawText(line, {
            x,
            y: firstBaseline - j * lineHeight,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            // Keeps a long address inside its own sticker instead of running
            // across the one next to it.
            maxWidth: mm(preset.width) - padding * 2,
          });
        }
      }

      downloadPdf(await doc.save(), t.outName);
      setStatus(t.done(labels.length, sheets));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  // Geometry/border/padding from the shared primitive; the pack ships no CSS.
  const field = "field-boxed w-full";

  return (
    <div className="label-sheet space-y-5">
      <label className="block text-sm">
        <span className="mb-1 block opacity-80">{t.sheet}</span>
        <select className={field} value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block opacity-80">{t.content}</span>
        <textarea
          className={field}
          rows={8}
          value={text}
          placeholder={t.placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="mt-1 block text-xs opacity-60">{t.contentHint}</span>
        {parsed.length > 0 && (
          <span className="mt-1 block text-xs opacity-60">{t.preview(parsed.length)}</span>
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block opacity-80">{t.startAt}</span>
          <input
            type="number"
            min={1}
            max={perSheet}
            className={field}
            value={startAt}
            // Clamped to the sheet here, not only inside run(): the field
            // accepted 999, showed 999 and silently printed from position
            // `perSheet`, so the number on screen was not the number used.
            onChange={(e) => setStartAt(Math.min(Math.max(1, Number(e.target.value) || 1), perSheet))}
          />
          <span className="mt-1 block text-xs opacity-60">{t.startAtHint}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block opacity-80">
            {t.fontSize}: {fontSize} pt
          </span>
          <input
            type="range"
            min={6}
            max={18}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block opacity-80">{t.align}</span>
          <select
            className={field}
            value={align}
            onChange={(e) => setAlign(e.target.value as "left" | "center")}
          >
            <option value="left">{t.alignLeft}</option>
            <option value="center">{t.alignCenter}</option>
          </select>
        </label>
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <span>
            {t.repeat}
            <span className="mt-0.5 block text-xs opacity-60">{t.repeatHint}</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
          <span>
            {t.guides}
            <span className="mt-0.5 block text-xs opacity-60">{t.guidesHint}</span>
          </span>
        </label>
      </div>

      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
        {busy ? t.working : t.run}
      </button>

      {error && <p className="status-pill status-pill--danger text-sm" role="alert">{error}</p>}
      {status && <p className="status-pill status-pill--success text-sm">{status}</p>}

      <p className="text-xs opacity-60">{t.note}</p>
    </div>
  );
}
