---
name: slide-layouts
description: >
  Edit or add slide layouts, layout primitives, remark directives, and custom
  slide exhibits in slide-lib and slide-lib decks, while keeping the 1920x1080
  stage and HTML <-> PPTX pipelines in sync.
---

# Editing & Adding Slide Layouts (`slide-lib`)

Use this skill when adding or modifying slide layouts, semantic layout primitives, Markdown directives (`::` / `:::`), or custom React slide layouts in `slide-lib` or a `slide-lib` deck repo.

---

## 1. Built-In Layouts & Directives

Each slide in `content/<number>.mdx` sets a `layout` in YAML frontmatter (defaulting to `"default"`):

| Layout | CSS Class | Purpose |
| :--- | :--- | :--- |
| `default` | `.slide` | Top-aligned editorial flow (`max-width: 1664px` inside `1920×1080`) |
| `center` | `.slide.center` | Centered title/CTA layout |
| `section` | `.slide.section` | 2-column section divider (`1.15fr` title / `0.85fr` index) |
| `about` | `.slide.about` | Speaker portrait (`400px`) + bio column |
| `exhibit` | `.slide.exhibit` | Full-stage exhibit presentation |
| `canvas` | `.slide.canvas` | Exact pixel-coordinate box layout (`<CanvasSlide>` + `<CanvasBox>`) |

Inside any layout, `remarkSlideDirectives` compiles declarative Markdown into layout primitives:
- **2-Column Split**: `::right::` or `::right{variant="shot"}` (`0.78fr` left / `1.42fr` right) → `<ContextGrid>`
- **Multi-Column Cards**: `:::grid` (optional `{cols=2..5}`) with `## Label` cards → `<CapabilityMap>` + `<CapabilityCard>`
- **Concept Pairs**: `:::concepts` with `## Label` cards → `<ConceptGrid>` + `<ConceptCard>`
- **Callouts**: Consecutive `:::callout[Tag]`, `:::warning[Tag]`, `:::success[Tag]` → `<CalloutStack>` + `<CalloutBox>`
- **Visual Exhibits**: `:::visual[Label]` → `<SlideVisual>` (`data-pptx="raster"`)
- **Quotes, Agenda, Stats, Footers**: `:::quote[Cite]`, `:::agenda`, `::stat[Val]{unit="+" caption="..."}`, `::footer[...]`

---

## 2. Adding or Editing a Built-In Layout in `slide-lib`

When adding a new `layout` or layout primitive to `slide-lib`, update these files in order:

1. **Schema (`src/schemas.ts`)**
   - Add the layout name to `SlideLayoutSchema`.
2. **Slide Stage (`src/deck/Slide.tsx`)**
   - `<Slide>` applies `className={layout === "default" ? "slide" : \`slide \${layout}\`}` and `data-slide-layout={layout}`.
   - Adjust eyebrow visibility here if the layout hides or repositions `.slide-eyebrow`.
3. **Stage Geometry (`src/styles/base.css`)**
   - Define `.slide.<layout>` inside the fixed `1920×1080` `.deck-slide` container (`padding: 84px 128px`, inner box `1664×912`).
4. **React Primitive (`src/components/primitives.tsx` & `src/index.ts`)**
   - Add any new reusable layout component to `primitives.tsx` and export it in `src/index.ts`.
   - `src/deck/Deck.tsx` spreads `* as Primitives` into `slideMdxComponents`, making it available in every `.mdx` file automatically.
5. **Markdown Directive (`src/mdx/remark-slide-directives.ts`)**
   - If the layout primitive has shorthand syntax (`:::my-block` or `::my-slot`), lower the directive node to `jsxFlow("MyComponent", ...)` in `transformNodes()`.
6. **HTML → PPTX Exporter (`src/export/dom-walker.ts`)**
   - Native shape cards: add `data-pptx-card="my-card"` on elements whose background or border should export as native PowerPoint shapes.
   - Raster islands: add `data-pptx="raster"` on complex visual widgets so they export as `@2x` transparent PNGs.
   - Native videos: add `data-pptx-video="/file.mp4"` and `data-pptx-poster="/poster.jpg"` on `<video>` (or export-mode `<img>`) elements.
7. **PPTX → MDX Importer (`src/import/layout-classifier.ts` & `src/import/mdx-emitter.ts`)**
   - Optional: add classification heuristics and MDX emission if imported `.pptx` slides should map to the new layout.

---

## 3. Customizing Layouts & Exhibits in a Deck Repo

When working inside an individual slide deck repo (e.g. `content/*.mdx` + `src/deck.css`):

1. **Insert Slides Without Renumbering**
   - Use decimal filenames (`content/12.5.mdx`) to insert a slide between `12.mdx` and `13.mdx`.
2. **Register Custom React Layouts / Exhibits**
   - Build custom layout or visual components in `src/components/Exhibits.tsx`.
   - Pass them to `<Deck components={{ MyExhibit }}>` in `src/App.tsx`.
   - Wrap visual exhibits in `:::visual[Description]` in `.mdx` so `.pptx` export captures them cleanly.
3. **Style Overrides (`src/deck.css`)**
   - Scope deck-specific layout tweaks in `src/deck.css`.
   - Prefer clean, borderless surfaces or thin left-accent bars (`border-left: 3px solid var(--accent)`) over deeply nested bordered boxes.
4. **Update Section Ranges**
   - If slide numbers shift, update the `SECTIONS` `{ label, from }` array in `src/App.tsx` (or `vite.config.ts`).

---

## 4. Verification Checklist

Always run these checks after editing or adding a layout:

- **Unit & Integration Tests (`slide-lib`)**:
  ```bash
  npm test
  ```
- **Production Build**:
  ```bash
  npm run build
  ```
- **Zero-Overflow Check (`1920×1080`)**:
  Open each slide (`/:n`) in headless Chrome and verify `.deck-slide` has `scrollWidth <= 1920` and `scrollHeight <= 1080`.
- **PPTX Export Check**:
  ```bash
  npx slide-lib export --url http://localhost:5173 --out deck.pptx
  ```
