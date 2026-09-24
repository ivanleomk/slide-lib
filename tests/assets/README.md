# Recorded Test Fixtures (`tests/assets/`)

All fixtures in `tests/assets/` are captured from real headless Chrome (`1920×1080`, `deviceScaleFactor: 2`, `reducedMotion: "reduce"`) and `pptxgenjs` OpenXML output via `npm run generate:mocks` (`scripts/generate-mocks.ts`).

## `dom_extraction/`

- `request.json`: Input slide specifications and HTML stage frames covering `center` title slides with `<Em>` underline accents, `context-grid` slides with Shiki code cards and `<SlideVisual>` (`data-pptx="raster"`) SVG exhibits, and `capability-map` 3-column model cards.
- `response.jsonl`: Captured `ExtractedSlide` records (one JSON object per line) emitted by the in-browser DOM walker (`buildBrowserDomExtractorScript`) including computed bounding boxes, inline Shiki color runs, rotated `.em` underline vector shapes, and `@2x` PNG data URIs.

## `pptx_roundtrip/`

- `sample_deck.pptx`: Binary OpenXML `.pptx` presentation generated from `dom_extraction/response.jsonl` via `buildPptxBuffer`, used to verify both editable OpenXML generation (`tests/export-pptx.test.ts`) and `PPTX → MDX` semantic/exact import round-tripping (`tests/import-pptx.test.ts`).
