# AGENTS.md — tds-tool-office-pkg

A **tool package** for the TDS tools platform: three **premium** office tools —
label sheets, a monthly timesheet, and OCR text recognition. All fully
client-side. Read `tds-tools-contract-pkg`'s AGENTS.md for the platform model and
`tds-tools-frontend/TOOLS-PLATFORM.md` for the operator handbook.

## Shape

- `src/index.ts` — the `ToolPackManifest` (three tools). The only file tsup
  compiles and `tsc` type-checks.
- `tools/*.astro` — shells the site's `/tools/[slug]` template renders. Each
  takes `lang` and forwards it to its island.
- `islands/*.tsx` — hydrated React islands. `pdf-lib` for the two that write a
  PDF; `tesseract.js` for the OCR tool.
- `islands/shared.ts` — `mm`, `A4`, `downloadPdf`, `toWinAnsi`, `parseTime`,
  `workedMinutes`, `formatDuration`.

## The tools

| id / slug | island | engine |
|---|---|---|
| `etiketten-drucken` | `LabelSheet` | pdf-lib |
| `stundenzettel` | `Timesheet` | pdf-lib |
| `texterkennung` | `TextRecognition` | **tesseract.js** |

## The OCR assets are the site's, and that is deliberate

tesseract.js by default fetches its worker, its WebAssembly core and the language
data from a third-party CDN. That would make *opening* a tool whose whole promise
is "nothing leaves your device" contact somebody else — and it drags a foreign
host into the consent story of a German site.

So the island pins explicit paths (`OCR_PATHS` in `TextRecognition.tsx`):

```
workerPath: "/ocr/worker.min.js"
corePath:   "/ocr"
langPath:   "/ocr/lang"
```

`tds-tools-frontend/scripts/sync-ocr.mjs` fills `public/ocr/` at prebuild from
`node_modules`, and the two `*.traineddata.gz` files are committed in that repo.
**Change these paths and the privacy claim quietly stops being true** — nothing
breaks, the tool simply starts phoning a CDN.

Two details worth keeping in mind before touching the copy step:

- tesseract.js asks for the **single-file** core (`tesseract-core-*.wasm.js`,
  wasm inlined as base64), not the small loader plus a separate `.wasm`. Copying
  the wrong pair yields a 404 at first use and nothing at build time.
- It picks among a plain, a `simd` and a `relaxedsimd` build at runtime, all in
  the `-lstm` flavour for the default OEM. All three are copied; shipping only
  one works on the developer's machine and fails on somebody else's.

## Gotchas

- **This pack ships NO CSS — every control must carry a shared class.** A surface
  layer only sets tokens; they reach an element through `btn` / `chip` /
  `field-boxed` / `status-pill` / `tds-table`. An `<input>` without `field-boxed`
  renders **invisible**, because Tailwind preflight zeroes borders — and the
  timesheet is a grid of about 124 inputs. `npm run lint:primitives` runs in CI.
- **`status-pill` ist ein Etikett, keine Blockmeldung.** Die Plakette hat
  `white-space: nowrap` und Versalien und ist für ein Wort gedacht. Eine
  Fehlermeldung darin bricht nicht um, sondern macht das Dokument breiter als
  das Fenster: im JSON-Formatter waren es 460px bei 390px Fenster, weil die
  Meldung den Text des Browsers trägt und damit beliebig lang ist. Zu sehen
  ist davon nichts — `body { overflow-x: hidden }` schneidet den Überhang ab,
  man findet es nur, indem man `document.documentElement.scrollWidth` misst.
  Für eine Meldung über mehrere Zeilen ist `tds-alert` (`--success` /
  `--warning` / `--danger`) die richtige Klasse; tds-shared sagt das im
  Kommentar über `.status-pill` auch selbst. Ein `<span>` als kurzes Etikett
  neben etwas anderem bleibt eine Plakette.
- **Never hand-author a radius**, and do not reach for
  a `rounded-[…]` arbitrary value: Tailwind generates no arbitrary value out of a
  package inside `node_modules`, so from here it ships as no rule at all.
- **`display: flex` on a `<td>`/`<th>` is a bug**, not a style choice — it takes
  the cell out of the table's column algorithm and the column drifts away from
  its header. The linter fails on it. The timesheet's `<table>` carries
  `tds-table` and nothing else; the primitive turns itself into a horizontal
  scroller below 40rem, and it has `tabindex="0"` + `role="region"` + a label so
  that scrollport is reachable by keyboard.
- **`islands/` is NOT type-checked here** (`tsconfig` covers `src/**/*` only).
  The `tds-tools-frontend` build is the real gate for a markup change.
- **Standard PDF fonts are WinAnsi-encoded.** `toWinAnsi` folds typographic
  quotes and dashes down and drops the rest, because pdf-lib **throws** at draw
  time on an unencodable character. An address pasted out of Word is the normal
  input here, so this is not an edge case; `Timesheet.test.ts` pins both halves —
  that sanitised text draws, and that unsanitised text throws.
- **A shift that ends before it starts runs past midnight**, it is not a negative
  day. `workedMinutes` wraps; treating it as negative would quietly corrupt the
  monthly total on exactly the sheet a late shift appears on.
- **Label geometry is checked against the sheet.** A grid wider or taller than A4
  prints stickers that fall off the edge, and the PDF looks perfectly fine until
  it comes out of the printer — `LabelSheet.test.ts` measures every preset.
  The product codes in the preset labels are compatibility hints; what matters is
  the geometry, and a sheet from any brand with the same grid fits.
- **PDF user space has its origin bottom-left**, but a label grid is counted from
  the top of the sheet. Both PDF-writing islands measure rows downwards from
  `A4.h`; getting that backwards mirrors the whole sheet.
- `component` = package subpath via `exports`, never relative.
- Tool `id` + `slug` globally unique across composed packs.
- All three declare `premiumDefault: true` + `priceCentsDefault`. The paywall
  lives in the site's tool page and `tds-ext-tools-pkg`, not here.
- Version stays in the `0.1.x` line (the site pins `^0.1.0`; a 0.x caret is
  minor-locked).

## Tests

`npm run test:run` (vitest), and unlike the four older tool packs **the suite
runs in CI**, between `lint:primitives` and `build`.

- `src/index.test.ts` — manifest contract, the monetisation fields both ways, and
  the copy budgets the site measures.
- `islands/shared.test.ts` — time parsing, the past-midnight shift, the
  never-negative clamp, duration formatting past 24 hours, WinAnsi folding
  (including that line breaks survive, since an address has several lines).
- `islands/LabelSheet.test.ts` — label splitting (Windows line endings, trailing
  blank lines) and every preset's geometry against A4.
- `islands/Timesheet.test.ts` — month lengths including a leap February and the
  empty `<input type="month">`, weekly totals, and that 31 rows still fit one
  page.

`test-setup.ts` shims `Blob.arrayBuffer`, which jsdom 25 lacks.

## Release

Push to `main` auto-releases a patch to GitHub Packages `@latest` and dispatches
a rebuild of `tds-tools-frontend`. The manual button is for a minor/major bump.
