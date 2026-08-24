// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The OCR island — the only one in this pack that had no test at all, and the
 * one carrying the pack's privacy claim.
 *
 * Two very different things are asserted here:
 *
 *  1. **Where the engine loads its assets from.** `OCR_PATHS` points at this
 *     site's own `/ocr/…`, filled by `sync-ocr.mjs` at prebuild. Change those
 *     three strings and tesseract.js silently falls back to its CDN: the tool
 *     keeps working, nothing errors, and the promise printed directly under the
 *     button — "the image is not uploaded and no third-party site is contacted"
 *     — quietly stops being true. Nothing else in the repo can see that, so it
 *     is pinned as source text (the constant is module-private on purpose).
 *
 *  2. **The copy button**, which reported the wrong failure: a clipboard denial
 *     set `t.failed` ("the text could not be recognised") while the recognised
 *     text sat on screen.
 */

const SOURCE = readFileSync(join(__dirname, "TextRecognition.tsx"), "utf8");

describe("OCR assets stay on this site", () => {
  it("points the worker, core and language data at our own origin", () => {
    expect(SOURCE).toContain('workerPath: "/ocr/worker.min.js"');
    expect(SOURCE).toContain('corePath: "/ocr"');
    expect(SOURCE).toContain('langPath: "/ocr/lang"');
  });

  it("names no external host anywhere in the island", () => {
    // A CDN URL here is the exact shape the privacy claim forbids. jsdelivr and
    // unpkg are tesseract.js's own defaults, so they are the likely regression.
    const urls = SOURCE.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
    expect(urls).toEqual([]);
  });

  it("passes those paths to the worker rather than declaring them decoratively", () => {
    // The constant existing is worth nothing if the call stops spreading it.
    expect(SOURCE).toMatch(/createWorker\([\s\S]{0,120}\.\.\.OCR_PATHS/);
  });
});

// --- The copy button ------------------------------------------------------

/** Text the stubbed engine "recognises". */
let recognisedText = "Hallo Welt";
let writeText: ReturnType<typeof vi.fn>;

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(async () => ({
    recognize: vi.fn(async () => ({ data: { text: recognisedText, confidence: 92 } })),
    terminate: vi.fn(async () => {}),
  })),
}));

const { default: TextRecognition } = await import("./TextRecognition");

/**
 * Install our clipboard double.
 *
 * Must run AFTER `userEvent.setup()`: user-event installs its own
 * `navigator.clipboard` stub there, which silently replaces anything set
 * earlier — so a mock defined in `beforeEach` is never the one called, and a
 * rejection configured on it never happens.
 */
function installClipboard() {
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

beforeEach(() => {
  recognisedText = "Hallo Welt";
  installClipboard();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:mock") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Pick an image and run the (stubbed) recognition. */
async function recognise(lang?: "en") {
  const u = userEvent.setup({ delay: null });
  installClipboard();
  render(lang ? <TextRecognition lang={lang} /> : <TextRecognition />);
  const file = new File([new Uint8Array(16)], "scan.png", { type: "image/png" });
  await u.upload(screen.getByLabelText(lang === "en" ? /Choose an image/ : /Bild wählen|Bild auswählen/), file);
  await u.click(screen.getByRole("button", { name: lang === "en" ? "Recognise text" : "Text erkennen" }));
  await screen.findByDisplayValue(recognisedText);
  return u;
}

describe("copy", () => {
  it("puts the recognised text on the clipboard", async () => {
    const u = await recognise();
    await u.click(screen.getByRole("button", { name: "Kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Hallo Welt"));
  });

  it("reports a CLIPBOARD failure, not a recognition failure", async () => {
    // The bug: a denied clipboard set "Der Text konnte nicht erkannt werden."
    // while the recognised text was visible on screen.
    const u = await recognise();
    writeText.mockRejectedValueOnce(new Error("denied"));
    await u.click(screen.getByRole("button", { name: "Kopieren" }));

    expect(await screen.findByText("Der Text konnte nicht kopiert werden.")).toBeDefined();
    expect(screen.queryByText("Der Text konnte nicht erkannt werden.")).toBeNull();
  });

  it("says so in English too", async () => {
    const u = await recognise("en");
    writeText.mockRejectedValueOnce(new Error("denied"));
    await u.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByText("The text could not be copied.")).toBeDefined();
    expect(screen.queryByText("The text could not be recognised.")).toBeNull();
  });

  it("does nothing when there is no text yet", async () => {
    // Writing "" would wipe whatever the user already had on their clipboard,
    // and an empty copy is not an error worth reporting either.
    const u = userEvent.setup({ delay: null });
    installClipboard();
    render(<TextRecognition />);
    const button = screen.queryByRole("button", { name: "Kopieren" });
    if (button) {
      await u.click(button);
      expect(writeText).not.toHaveBeenCalled();
    }
  });

  it("clears the copied notice again so the result summary comes back", async () => {
    const u = await recognise();
    await u.click(screen.getByRole("button", { name: "Kopieren" }));
    expect(await screen.findByText("Kopiert.")).toBeDefined();

    await waitFor(() => expect(screen.queryByText("Kopiert.")).toBeNull(), { timeout: 3000 });
  });
});
