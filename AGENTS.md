# AGENTS.md — tds-tool-office-pkg

Tool pack for the public tools platform with three **premium** office tools: label
sheets, a monthly timesheet and OCR text recognition. All run fully client-side.
It builds against `@tracht-digital-solutions/tds-tools-contract` and is composed into
`tds-tools-frontend` at build time.

Platform model: `tds-tools-contract-pkg/AGENTS.md`. Operator handbook:
`tds-tools-frontend/TOOLS-PLATFORM.md`.

## Commands

```bash
npm install --no-package-lock   # never npm ci; CI has no lockfile
npm run build                   # tsup, compiles src/index.ts only
npm run type-check              # tsc, covers src/** only
npm run test:run                # vitest (also runs in CI)
npm run lint:primitives         # fails on a bare control or a flex table cell
```

## Hard rules

- **Every push to `main` publishes a `@latest` patch** and deploys `tds-tools-frontend` (dispatches its `release.yml`).
  The manual release button is for minor/major. A docs-only commit carries `[skip ci]`.
- **Never change the OCR asset paths.** Otherwise the tool silently loads from a CDN and the privacy claim becomes false.
- Text drawn into a PDF goes through `toWinAnsi`; pdf-lib throws on unencodable characters.
- All three tools declare `premiumDefault: true` and `priceCentsDefault`. The paywall lives in the site and `tds-ext-tools-pkg`.
- Ship no CSS. Every control carries a shared `tds-shared` class.
- `component` is a package subpath resolved via `exports`. Tool `id` and `slug` stay unique.
- Stay inside the `0.2.x` line. The site pins `^0.2.0`, and a 0.x caret is minor-locked.

## Topic files

| File | Read before |
|---|---|
| [docs/agents/architecture.md](docs/agents/architecture.md) | Changing the manifest, tools or shared helpers |
| [docs/agents/ocr-assets.md](docs/agents/ocr-assets.md) | Touching `TextRecognition`, `OCR_PATHS` or the site's OCR copy step |
| [docs/agents/pdf-output.md](docs/agents/pdf-output.md) | Changing label or timesheet PDF output, fonts or time maths |
| [docs/agents/conventions.md](docs/agents/conventions.md) | Touching any markup or styling, especially tables |
| [docs/agents/testing.md](docs/agents/testing.md) | Writing or changing tests |

Workspace rules: `../CLAUDE.md`. Cross-repo state: `../MIGRATION-STATUS.md`.
