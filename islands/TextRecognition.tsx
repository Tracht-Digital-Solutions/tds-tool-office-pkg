import { useEffect, useRef, useState } from "react";
import { downloadBlob, type Lang } from "./shared";

type Recognised = "deu" | "eng" | "deu+eng";

interface Strings {
  needImage: string;
  failed: string;
  empty: string;
  done: (chars: number, confidence: number) => string;
  chooseImage: string;
  language: string;
  german: string;
  english: string;
  both: string;
  loading: string;
  recognising: (percent: number) => string;
  run: string;
  result: string;
  copy: string;
  copied: string;
  copyFailed: string;
  save: string;
  outName: string;
  pdfHint: string;
  note: string;
}

/** German is the default; an older pinned pack must keep working unchanged. */
const STRINGS = {
  de: {
    needImage: "Bitte ein Bild wählen.",
    failed: "Der Text konnte nicht erkannt werden.",
    empty:
      "Es wurde kein Text gefunden. Ein schärferes, gerade ausgerichtetes Bild mit gutem Kontrast hilft am meisten.",
    done: (chars, confidence) => `${chars} Zeichen erkannt (Sicherheit ${confidence} %).`,
    chooseImage: "Bild auswählen (JPG, PNG, WebP)",
    language: "Sprache des Textes",
    german: "Deutsch",
    english: "Englisch",
    both: "Deutsch und Englisch",
    loading: "Lade Texterkennung …",
    recognising: (percent) => `Erkenne Text … ${percent} %`,
    run: "Text erkennen",
    result: "Erkannter Text",
    copy: "Kopieren",
    copied: "Kopiert.",
    copyFailed: "Der Text konnte nicht kopiert werden.",
    save: "Als Textdatei speichern",
    outName: "erkannter-text.txt",
    pdfHint:
      "PDFs werden hier nicht gelesen — wandeln Sie eine Seite zuerst in ein Bild um, dann klappt die Erkennung.",
    note: "Texterkennung und Sprachdaten laufen auf Ihrem Gerät. Das Bild wird nicht hochgeladen und keine fremde Seite wird dabei aufgerufen.",
  },
  en: {
    needImage: "Please choose an image.",
    failed: "The text could not be recognised.",
    empty:
      "No text was found. A sharper, straight image with good contrast makes the biggest difference.",
    done: (chars, confidence) => `Recognised ${chars} characters (confidence ${confidence} %).`,
    chooseImage: "Choose an image (JPG, PNG, WebP)",
    language: "Language of the text",
    german: "German",
    english: "English",
    both: "German and English",
    loading: "Loading text recognition …",
    recognising: (percent) => `Recognising text … ${percent} %`,
    run: "Recognise text",
    result: "Recognised text",
    copy: "Copy",
    copied: "Copied.",
    copyFailed: "The text could not be copied.",
    save: "Save as a text file",
    outName: "recognised-text.txt",
    pdfHint:
      "PDFs are not read here — convert a page to an image first and recognition will work.",
    note: "Recognition and the language data run on your device. The image is not uploaded and no third-party site is contacted.",
  },
} satisfies Record<Lang, Strings>;

/**
 * The engine, its WebAssembly core and the language data are served by this site
 * (`public/ocr/`, filled by `scripts/sync-ocr.mjs`) rather than by tesseract.js's
 * default CDN. That is the whole privacy claim of this tool: opening it must not
 * contact anybody. Change these paths and the claim quietly stops being true.
 */
const OCR_PATHS = {
  workerPath: "/ocr/worker.min.js",
  corePath: "/ocr",
  langPath: "/ocr/lang",
} as const;

/**
 * Premium OCR tool — reads the text out of a photo or a scanned image, in German
 * or English, entirely on the visitor's device via tesseract.js.
 */
interface Props {
  lang?: Lang;
}

export default function TextRecognition({ lang = "de" }: Props) {
  const t = STRINGS[lang];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recognised, setRecognised] = useState<Recognised>(lang === "de" ? "deu" : "eng");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "working">("idle");
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The preview URL is a manual resource; without this it leaks for the life of
  // the tab, and a phone photo is several megabytes.
  const previewUrl = useRef<string | null>(null);
  const replacePreview = (next: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewUrl.current);
  };
  /** Pending "Kopiert." reset, cleared on unmount so it cannot set state after. */
  const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      if (copyReset.current !== null) clearTimeout(copyReset.current);
    },
    [],
  );

  const run = async () => {
    setError(null);
    setStatus(null);
    setText("");
    setPercent(0);
    try {
      if (!file) throw new Error(t.needImage);
      setPhase("loading");
      // Lazily imported: the engine is over a megabyte, and a visitor reading the
      // guide should not pay for it.
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(recognised, 1, {
        ...OCR_PATHS,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setPhase("working");
            setPercent(Math.round(m.progress * 100));
          }
        },
      });
      try {
        const { data } = await worker.recognize(file);
        const clean = data.text.trim();
        setText(clean);
        if (clean === "") {
          setStatus(t.empty);
        } else {
          setStatus(t.done(clean.length, Math.round(data.confidence)));
        }
      } finally {
        await worker.terminate();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setPhase("idle");
    }
  };

  const copy = async () => {
    // Nothing to copy is not a failure, and writing "" would clear whatever the
    // user already had on the clipboard.
    if (text === "") return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t.copied);
      // Same 1.5s reset as every other copy button in the tool packs. Without
      // it "Kopiert." replaces the recognition summary permanently, so the
      // character count and confidence the user was reading simply vanish.
      if (copyReset.current !== null) clearTimeout(copyReset.current);
      copyReset.current = setTimeout(() => setStatus(null), 1500);
    } catch {
      // A clipboard denial is NOT an OCR failure. Reporting `t.failed` here
      // told the user their text could not be recognised while it sat on the
      // screen in front of them.
      setError(t.copyFailed);
    }
  };

  const busy = phase !== "idle";
  // Geometry/border/padding from the shared primitive; the pack ships no CSS.
  const field = "field-boxed w-full";

  return (
    <div className="text-recognition space-y-5">
      <label className="block text-sm">
        <span className="mb-1 block opacity-80">{t.chooseImage}</span>
        <input
          type="file"
          accept="image/*"
          className={field}
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            replacePreview(next);
          }}
        />
        <span className="mt-1 block text-xs opacity-60">{t.pdfHint}</span>
      </label>

      {preview && (
        <img src={preview} alt="" className="max-h-64 w-auto" />
      )}

      <label className="block text-sm">
        <span className="mb-1 block opacity-80">{t.language}</span>
        <select
          className={field}
          value={recognised}
          onChange={(e) => setRecognised(e.target.value as Recognised)}
        >
          <option value="deu">{t.german}</option>
          <option value="eng">{t.english}</option>
          <option value="deu+eng">{t.both}</option>
        </select>
      </label>

      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
        {phase === "loading" ? t.loading : phase === "working" ? t.recognising(percent) : t.run}
      </button>

      {error && <p className="status-pill status-pill--danger text-sm" role="alert">{error}</p>}
      {status && <p className="status-pill status-pill--success text-sm">{status}</p>}

      {text !== "" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block opacity-80">{t.result}</span>
            <textarea
              className={field}
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {t.copy}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), t.outName)
              }
            >
              {t.save}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs opacity-60">{t.note}</p>
    </div>
  );
}
