# `slide-lib`

Extensible Vite + MDX slide engine, semantic layout primitive library, bundled
Agent Plugin (`plugin.json` + `skills/slide-lib/SKILL.md`), and bidirectional
`HTML <-> editable PPTX` pipeline.

## Key Features

- **1-Line Vite Plugin (`slide-lib/vite`)**: Wraps `@mdx-js/rollup`,
  `remark-frontmatter`, `remark-mdx-frontmatter`, `@shikijs/rehype`, Tailwind
  v4, and React.
- **Deterministic `1920×1080` Stage**: Auto-scales in live presentation mode and
  maps 1:1 to `13.333" × 7.5"` (16:9 Widescreen) in PowerPoint and Google
  Slides.
- **Parallel Final-State Export Handoff (`?export=all` & `useSlideFinalState`)**:
  Loads all slides simultaneously in their finished state (`[data-fragment]`
  visible, animated widgets settled at `phase = "static"` with
  `prefers-reduced-motion: reduce`) instead of sequentially clicking from slide 1.
- **Hybrid `HTML -> Editable PPTX` Pipeline**:
  - Headings, paragraphs, eyebrows, cards, and Shiki code blocks become **native
    editable PPTX text runs and vector shapes** (with a `+4%` width buffer for
    Google Slides font metrics).
  - `<Em>` (`*italic*`) renders an editable italic text run + a native rotated
    terracotta underline bar.
  - `<SlideVisual>` (`data-pptx="raster"`) captures interactive React/SVG
    exhibits as `@2x` transparent PNG islands.
- **Bidirectional `PPTX -> MDX` Pipeline**:
  - Default `semantic` mode classifies slide coordinates into `<ContextGrid>`,
    `<CapabilityMap>`, `<CodeCard>`, and `center` layouts.
  - `--exact` mode emits pixel-accurate `<CanvasSlide>` and `<CanvasBox>`
    components.

## CLI Usage

```bash
# 1. Scaffold a new Vite + MDX deck
npx slide-lib init ./my-deck --title "Managed Agents Workshop" --theme warm-paper

# 2. Export a running Vite deck to an editable .pptx
npx slide-lib export --url http://localhost:5173 --out workshop.pptx

# 3. Import a .pptx deck into MDX slides (semantic or --exact)
npx slide-lib import ./workshop.pptx --out ./imported-deck
npx slide-lib import ./workshop.pptx --out ./imported-deck --exact
```
