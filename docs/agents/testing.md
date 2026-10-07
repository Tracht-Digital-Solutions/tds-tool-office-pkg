# Testing

`npm run test:run` runs vitest. CI runs it between `lint:primitives` and `build`.
`test-setup.ts` shims `Blob.arrayBuffer`, which jsdom 25 lacks.

| Suite | Covers |
|---|---|
| `src/index.test.ts` | Manifest contract, monetisation fields both ways, the copy budgets the site measures |
| `islands/shared.test.ts` | Time parsing, past-midnight shift, never-negative clamp, durations past 24 h, WinAnsi folding (line breaks survive) |
| `islands/LabelSheet.test.ts` | Label splitting (Windows line endings, trailing blank lines), every preset's geometry against A4 |
| `islands/Timesheet.test.ts` | Month lengths incl. leap February and empty `<input type="month">`, weekly totals, 31 rows on one page, sanitised text draws and unsanitised text throws |
