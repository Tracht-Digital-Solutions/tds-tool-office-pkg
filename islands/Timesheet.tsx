import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  A4,
  LOCALE,
  downloadPdf,
  formatDuration,
  mm,
  toWinAnsi,
  workedMinutes,
  type Lang,
} from "./shared";

interface DayEntry {
  start: string;
  end: string;
  pause: number;
  note: string;
}

interface Strings {
  failed: string;
  done: (days: number, total: string) => string;
  outName: (month: string) => string;
  employee: string;
  employer: string;
  month: string;
  fillWeekdays: string;
  fillHint: string;
  defaultStart: string;
  defaultEnd: string;
  defaultPause: string;
  apply: string;
  clear: string;
  day: string;
  date: string;
  from: string;
  to: string;
  pause: string;
  hours: string;
  noteCol: string;
  total: string;
  daysWorked: string;
  working: string;
  run: string;
  signEmployee: string;
  signEmployer: string;
  title: string;
  note: string;
  tableLabel: string;
}

/** German is the default; an older pinned pack must keep working unchanged. */
const STRINGS = {
  de: {
    failed: "Der Stundenzettel konnte nicht erstellt werden.",
    done: (days, total) => `${days} Arbeitstag(e), ${total} Stunden insgesamt.`,
    outName: (month) => `stundenzettel-${month}.pdf`,
    employee: "Mitarbeiterin / Mitarbeiter",
    employer: "Betrieb",
    month: "Monat",
    fillWeekdays: "Werktage vorbelegen",
    fillHint: "Trägt die Zeiten unten in alle Montage bis Freitage ein. Einzelne Tage bleiben änderbar.",
    defaultStart: "Beginn",
    defaultEnd: "Ende",
    defaultPause: "Pause (Min.)",
    apply: "Übernehmen",
    clear: "Alle Zeiten leeren",
    day: "Tag",
    date: "Datum",
    from: "Beginn",
    to: "Ende",
    pause: "Pause",
    hours: "Stunden",
    noteCol: "Bemerkung",
    total: "Summe",
    daysWorked: "Arbeitstage",
    working: "Erstelle …",
    run: "Stundenzettel erstellen & herunterladen",
    signEmployee: "Datum, Unterschrift Mitarbeiter/in",
    signEmployer: "Datum, Unterschrift Betrieb",
    title: "Arbeitszeitnachweis",
    note: "Der Stundenzettel wird lokal im Browser erzeugt; die Zeiten verlassen Ihren Rechner nicht.",
    tableLabel: "Arbeitszeiten je Tag",
  },
  en: {
    failed: "The timesheet could not be created.",
    done: (days, total) => `${days} working day(s), ${total} hours in total.`,
    outName: (month) => `timesheet-${month}.pdf`,
    employee: "Employee",
    employer: "Employer",
    month: "Month",
    fillWeekdays: "Prefill weekdays",
    fillHint: "Writes the times below into every Monday to Friday. Individual days stay editable.",
    defaultStart: "Start",
    defaultEnd: "End",
    defaultPause: "Break (min)",
    apply: "Apply",
    clear: "Clear all times",
    day: "Day",
    date: "Date",
    from: "Start",
    to: "End",
    pause: "Break",
    hours: "Hours",
    noteCol: "Note",
    total: "Total",
    daysWorked: "Working days",
    working: "Creating …",
    run: "Create timesheet & download",
    signEmployee: "Date, employee signature",
    signEmployer: "Date, employer signature",
    title: "Record of working time",
    note: "The timesheet is produced locally in your browser; the times never leave your machine.",
    tableLabel: "Working time per day",
  },
} satisfies Record<Lang, Strings>;

/** "2026-08" → the number of days in that month. */
export function daysInMonth(month: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || !m[1] || !m[2]) return 0;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const EMPTY: DayEntry = { start: "", end: "", pause: 0, note: "" };

/**
 * Premium timesheet tool — a month of working times with breaks, per-day and
 * monthly totals, exported as a PDF to print and sign. Client-side via pdf-lib.
 */
interface Props {
  lang?: Lang;
}

export default function Timesheet({ lang = "de" }: Props) {
  const t = STRINGS[lang];
  const [employee, setEmployee] = useState("");
  const [employer, setEmployer] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [defStart, setDefStart] = useState("08:00");
  const [defEnd, setDefEnd] = useState("16:30");
  const [defPause, setDefPause] = useState(30);
  const [entries, setEntries] = useState<Record<number, DayEntry>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = daysInMonth(month);
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(y ?? 1970, (m ?? 1) - 1, i + 1);
      return {
        day: i + 1,
        date,
        weekday: date.toLocaleDateString(LOCALE[lang], { weekday: "short" }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      };
    });
  }, [month, count, lang]);

  const entryFor = (day: number): DayEntry => entries[day] ?? EMPTY;
  const setEntry = (day: number, patch: Partial<DayEntry>) =>
    setEntries((prev) => ({ ...prev, [day]: { ...(prev[day] ?? EMPTY), ...patch } }));

  const totals = useMemo(() => {
    let minutes = 0;
    let worked = 0;
    for (const d of days) {
      const e = entryFor(d.day);
      const m = workedMinutes(e.start, e.end, e.pause);
      if (m > 0) {
        minutes += m;
        worked++;
      }
    }
    return { minutes, worked };
  }, [days, entries]);

  const prefill = () => {
    const next: Record<number, DayEntry> = { ...entries };
    for (const d of days) {
      if (d.isWeekend) continue;
      next[d.day] = { ...(next[d.day] ?? EMPTY), start: defStart, end: defEnd, pause: defPause };
    }
    setEntries(next);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const doc = await PDFDocument.create();
      const page = doc.addPage([mm(A4.w), mm(A4.h)]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const left = mm(15);
      const right = mm(A4.w - 15);
      let y = mm(A4.h - 18);

      const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(LOCALE[lang], {
        month: "long",
        year: "numeric",
      });

      page.drawText(toWinAnsi(t.title), { x: left, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 18;
      page.drawText(toWinAnsi(`${t.employee}: ${employee || "—"}`), { x: left, y, size: 10, font });
      page.drawText(toWinAnsi(monthLabel), { x: right - mm(45), y, size: 10, font });
      y -= 14;
      page.drawText(toWinAnsi(`${t.employer}: ${employer || "—"}`), { x: left, y, size: 10, font });
      y -= 16;

      const cols = [left, left + mm(14), left + mm(30), mm(15 + 62), mm(15 + 86), mm(15 + 108), mm(15 + 130)];
      const header = [t.day, "", t.from, t.to, t.pause, t.hours, t.noteCol];
      page.drawLine({
        start: { x: left, y: y + 12 },
        end: { x: right, y: y + 12 },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });
      header.forEach((label, i) => {
        if (!label) return;
        page.drawText(toWinAnsi(label), { x: cols[i]!, y, size: 9, font: bold });
      });
      y -= 4;
      page.drawLine({
        start: { x: left, y },
        end: { x: right, y },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 12;

      for (const d of days) {
        const e = entryFor(d.day);
        const minutes = workedMinutes(e.start, e.end, e.pause);
        // A weekend row is kept but shaded, so the sheet still reads as a whole
        // month and an unusual Saturday shift has somewhere to go.
        if (d.isWeekend) {
          page.drawRectangle({
            x: left,
            y: y - 3,
            width: right - left,
            height: 12,
            color: rgb(0.95, 0.95, 0.95),
          });
        }
        const cells = [
          String(d.day),
          d.weekday,
          e.start,
          e.end,
          e.pause > 0 ? String(e.pause) : "",
          minutes > 0 ? formatDuration(minutes) : "",
          e.note,
        ];
        cells.forEach((value, i) => {
          if (!value) return;
          page.drawText(toWinAnsi(value), {
            x: cols[i]!,
            y,
            size: 8.5,
            font,
            maxWidth: i === 6 ? right - cols[6]! : mm(20),
          });
        });
        y -= 12;
      }

      y -= 4;
      page.drawLine({
        start: { x: left, y: y + 8 },
        end: { x: right, y: y + 8 },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(
        toWinAnsi(`${t.total}: ${formatDuration(totals.minutes)}   ·   ${t.daysWorked}: ${totals.worked}`),
        { x: left, y: y - 6, size: 10, font: bold },
      );

      const signY = mm(24);
      page.drawLine({
        start: { x: left, y: signY },
        end: { x: left + mm(70), y: signY },
        thickness: 0.5,
      });
      page.drawLine({
        start: { x: right - mm(70), y: signY },
        end: { x: right, y: signY },
        thickness: 0.5,
      });
      page.drawText(toWinAnsi(t.signEmployee), { x: left, y: signY - 10, size: 8, font });
      page.drawText(toWinAnsi(t.signEmployer), { x: right - mm(70), y: signY - 10, size: 8, font });

      downloadPdf(await doc.save(), t.outName(month));
      setStatus(t.done(totals.worked, formatDuration(totals.minutes)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  // Geometry/border/padding from the shared primitive; the pack ships no CSS.
  const field = "field-boxed w-full";

  return (
    <div className="timesheet space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block opacity-80">{t.employee}</span>
          <input
            type="text"
            className={field}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block opacity-80">{t.employer}</span>
          <input
            type="text"
            className={field}
            value={employer}
            onChange={(e) => setEmployer(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block opacity-80">{t.month}</span>
          <input
            type="month"
            className={field}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm opacity-80">{t.fillWeekdays}</p>
        <div className="tds-toolbar flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block opacity-80">{t.defaultStart}</span>
            <input
              type="time"
              className="field-boxed"
              value={defStart}
              onChange={(e) => setDefStart(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block opacity-80">{t.defaultEnd}</span>
            <input
              type="time"
              className="field-boxed"
              value={defEnd}
              onChange={(e) => setDefEnd(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block opacity-80">{t.defaultPause}</span>
            <input
              type="number"
              min={0}
              max={240}
              className="field-boxed"
              value={defPause}
              onChange={(e) => setDefPause(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={prefill}>
            {t.apply}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEntries({})}>
            {t.clear}
          </button>
        </div>
        <p className="text-xs opacity-60">{t.fillHint}</p>
      </div>

      <table className="tds-table" tabIndex={0} role="region" aria-label={t.tableLabel}>
        <caption className="text-sm opacity-80">{t.tableLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{t.date}</th>
            <th scope="col">{t.from}</th>
            <th scope="col">{t.to}</th>
            <th scope="col">{t.pause}</th>
            <th scope="col">{t.hours}</th>
            <th scope="col">{t.noteCol}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const e = entryFor(d.day);
            const minutes = workedMinutes(e.start, e.end, e.pause);
            return (
              <tr key={d.day}>
                <td>
                  {d.day}. {d.weekday}
                </td>
                <td>
                  <input
                    type="time"
                    className="field-boxed"
                    aria-label={`${t.from} ${d.day}`}
                    value={e.start}
                    onChange={(ev) => setEntry(d.day, { start: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    className="field-boxed"
                    aria-label={`${t.to} ${d.day}`}
                    value={e.end}
                    onChange={(ev) => setEntry(d.day, { end: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    className="field-boxed"
                    aria-label={`${t.pause} ${d.day}`}
                    value={e.pause || ""}
                    onChange={(ev) => setEntry(d.day, { pause: Math.max(0, Number(ev.target.value)) })}
                  />
                </td>
                <td>{minutes > 0 ? formatDuration(minutes) : "—"}</td>
                <td>
                  <input
                    type="text"
                    className="field-boxed"
                    aria-label={`${t.noteCol} ${d.day}`}
                    value={e.note}
                    onChange={(ev) => setEntry(d.day, { note: ev.target.value })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-sm">
        <strong>{t.total}:</strong> {formatDuration(totals.minutes)} · {t.daysWorked}:{" "}
        {totals.worked}
      </p>

      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
        {busy ? t.working : t.run}
      </button>

      {error && <p className="status-pill status-pill--danger text-sm">{error}</p>}
      {status && <p className="status-pill status-pill--success text-sm">{status}</p>}

      <p className="text-xs opacity-60">{t.note}</p>
    </div>
  );
}
