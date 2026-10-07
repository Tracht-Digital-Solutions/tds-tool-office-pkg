# OCR assets are served by the site

By default tesseract.js fetches its worker, its WebAssembly core and the language data
from a third-party CDN. For a tool that promises "nothing leaves your device", merely
opening it would contact someone else and pull a foreign host into the consent story of
a German site.

## Pinned paths

The island pins explicit paths (`OCR_PATHS` in `TextRecognition.tsx`):

```
workerPath: "/ocr/worker.min.js"
corePath:   "/ocr"
langPath:   "/ocr/lang"
```

`tds-tools-frontend/scripts/sync-ocr.mjs` fills `public/ocr/` at prebuild from
`node_modules`. The two `*.traineddata.gz` files are committed in that repo.

**If you change these paths, the privacy claim quietly stops being true.** Nothing
breaks; the tool simply starts calling a CDN.

## Before touching the copy step

- tesseract.js requests the **single-file** core (`tesseract-core-*.wasm.js`, wasm
  inlined as base64), not the small loader plus a separate `.wasm`. Copying the wrong
  pair gives a 404 at first use and nothing at build time.
- It picks a plain, a `simd` or a `relaxedsimd` build at runtime, all in the `-lstm`
  flavour for the default OEM. All three are copied. Shipping only one works on the
  developer's machine and fails elsewhere.
