# @tracht-digital-solutions/tds-tool-office

Office tools for the **TDS tools platform** (`tds-tools-frontend`) — the
paperwork a small business actually has. Fully client-side; nothing is uploaded.

## Tools

| id | slug | premium | description |
|---|---|---|---|
| `etiketten-drucken` | `etiketten-drucken` | **yes** | Address labels on a standard A4 grid, print-ready PDF |
| `stundenzettel` | `stundenzettel` | **yes** | A month of working times with breaks and totals, as a PDF to sign |
| `texterkennung` | `texterkennung` | **yes** | OCR for photos and scanned images, German and English |

All three ship `premiumDefault: true` + `priceCentsDefault: 500`; the admin
catalog decides the final gating and price. The paywall (login + purchase) is
enforced by the site's tool page and `tds-ext-tools-pkg`, not by this package.

## The OCR tool needs assets from the site

`texterkennung` deliberately does **not** use tesseract.js's default CDN. It
pins `/ocr/worker.min.js`, `/ocr` and `/ocr/lang`, which
`tds-tools-frontend/scripts/sync-ocr.mjs` fills at prebuild. That is what makes
"the image is not uploaded and no third-party site is contacted" true rather than
merely half-true. See `AGENTS.md` for what the copy step must include and why.

## Develop

```bash
npm install --no-package-lock
npm run type-check
npm run lint:primitives
npm run test:run     # vitest — manifest + island logic
npm run build
```

## Tests

- **`src/index.test.ts`** — the manifest contract and the **monetisation
  fields**: `premiumDefault` drives the site's `ToolGate`, `priceCentsDefault`
  seeds Stripe Checkout, and a flag lost in an edit silently makes a paid tool
  free. It also measures the copy budgets the tools site enforces.
- **`islands/shared.test.ts`** — time parsing and the working-time arithmetic,
  including that a shift ending before it starts is read as running past
  midnight rather than as a negative day.
- **`islands/LabelSheet.test.ts`** — label splitting (multi-line addresses,
  Windows line endings, trailing blank lines) and **every preset's geometry
  measured against A4**, because a grid that overflows the sheet produces a PDF
  that looks perfect until it comes out of the printer.
- **`islands/Timesheet.test.ts`** — month lengths (leap February, empty month
  input), weekly totals, and that a 31-row month still fits on one page. It also
  pins both halves of the WinAnsi rule: sanitised text draws, unsanitised text
  throws.

`test-setup.ts` shims `Blob.arrayBuffer`, which jsdom lacks — a limitation of the
test DOM, not of the tools.

The `.astro` shells and `.tsx` islands are compiled at the **site** build.
Release happens on push to `main` (auto patch to `@latest`; the manual button is
for minor/major). See `tds-tools-contract-pkg` for the platform model.
