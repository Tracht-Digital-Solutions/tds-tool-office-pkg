# Architecture

## Layout

- `src/index.ts` — the `ToolPackManifest` with three tools. It is the only file tsup
  compiles and `tsc` type-checks.
- `tools/*.astro` — shells that the site's `/tools/[slug]` template renders. Each takes
  `lang` and forwards it to its island.
- `islands/*.tsx` — hydrated React islands. `pdf-lib` for the two that write a PDF,
  `tesseract.js` for OCR.
- `islands/shared.ts` — `mm`, `A4`, `downloadPdf`, `toWinAnsi`, `parseTime`,
  `workedMinutes`, `formatDuration`.
- `islands/` and `tools/` are not type-checked here (`tsconfig` covers `src/**` only).
  The `tds-tools-frontend` build is the real gate for a markup change.

## Tools

| id / slug | island | engine |
|---|---|---|
| `etiketten-drucken` | `LabelSheet` | pdf-lib |
| `stundenzettel` | `Timesheet` | pdf-lib |
| `texterkennung` | `TextRecognition` | **tesseract.js** |

## Manifest contract

- `component` is a package subpath resolved via `exports`, never relative.
- Tool `id` and `slug` must stay unique across all composed packs.
- All three declare `premiumDefault: true` and `priceCentsDefault`. The paywall lives in
  the site's tool page and in `tds-ext-tools-pkg`, not here.
- The site pins `^0.2.0`; a 0.x caret is minor-locked, so a minor bump needs a repin.
