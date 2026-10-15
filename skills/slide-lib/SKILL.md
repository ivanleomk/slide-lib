---
name: slide-lib
description: >
  Scaffold, author, customize, and convert Vite + MDX slide decks using
  slide-lib. Covers semantic MDX layout primitives (ContextGrid, CapabilityMap,
  ConceptGrid, SectionIndex, CalloutStack, CodeCard, SlideVisual), decimal slide
  numbering, final-state interactive React widgets (useSlideFinalState), and
  bidirectional HTML <-> editable PPTX pipelines.
---

# `slide-lib` Slide Authoring & PPTX Pipeline Skill

Use this skill whenever the user wants to create a new slide deck, add or edit
MDX slides, build interactive React slide exhibits, export a Vite slide deck to
an editable `.pptx` (for Google Slides / PowerPoint / Keynote), or import a
`.pptx` deck into MDX slides.

---

## 1. Scaffolding a New Deck

Run the CLI scaffolder to create a minimal Vite + MDX slide deck:

```bash
npx slide-lib init ./my-deck --title "My Workshop" --theme warm-paper
```

Available themes (`data-theme`):
- `warm-paper` (`#faf8f3` warm editorial paper, `#b5522f` terracotta accent)
- `studio-light` (`#ffffff` crisp studio light, `#f7f4ec` card surface)

A scaffolded deck requires only:
- `vite.config.ts` with `slideDeckPlugin({ title, theme, sections })`
- `src/App.tsx` wrapping `<Deck>` + `<Slide>` + `<MDXProvider components={{ em: Em, ... }}>`
- `content/<number>.mdx` slide files

---

## 2. Slide Numbering & Frontmatter (`content/<number>.mdx`)

Slides live in `content/<number>.mdx` and are sorted numerically via
`Number.parseFloat`:
- Use integer filenames (`1.mdx`, `2.mdx`, `3.mdx`) for initial slides.
- Insert new slides between existing ones using **decimal numbers** (`6.5.mdx`,
  `6.6.mdx`, `16.5.mdx`) — **never renumber every subsequent slide** unless
  requested.

Supported YAML frontmatter fields:

```yaml
---
title: "Why a steps model"
layout: "default" # "default" | "center" | "section" | "about" | "exhibit" | "canvas"
eyebrow: "01 · AI Studio" # optional; overrides automatic section-range eyebrow
notes: "Speaker notes exported directly to PowerPoint / Google Slides notes."
---
```

---

## 3. Declarative Markdown Syntax & Layout Primitives

`<Deck>` automatically registers all built-in MDX components (`slideMdxComponents`), and `slideDeckPlugin()` compiles Slidev-inspired Markdown directives directly into semantic layout primitives:

- **Accent Emphasis (`*italic*` / `<Em>`)**:
  Standard markdown `*italic*` renders `<Em>`, placing the tilted terracotta underline beneath the word (`# Every run, laid out in *time*`).
- **2-Column Split (`::right::` or `::left` / `::right` -> `<ContextGrid>`)**:
  Place `::right::` (or `::left{variant="shot"}` + `::right::`) between left and right column Markdown blocks.
- **Multi-Column Grid (`:::grid` -> `<CapabilityMap>` + `<CapabilityCard>`)**:
  Inside `:::grid` (optional `{cols=2..5}`, auto-inferred from card count), each `## Model Label` starts a card, `### Title` adds a heading, and paragraphs/lists form the body.
- **Concept Breakdown (`:::concepts` -> `<ConceptGrid>` + `<ConceptCard>`)**:
  Inside `:::concepts`, each `## Label` starts a 2-column concept card with uppercase monospace accent labels.
- **Auto-Stacked Callouts (`:::callout[Tag]`, `:::warning[Tag]`, `:::success[Tag]` -> `<CalloutStack>` + `<CalloutBox>`)**:
  Consecutive callout directives automatically stack; `### Heading` sets the callout title.
- **Fenced Code Cards (` ```python title="file.py" ` -> `<CodeCard>`)**:
  Standard fenced code blocks (with `title="..."` or `[file.py]`) render as Shiki-highlighted dark cards and export to `.pptx` as native shapes with editable syntax-colored text runs.
- **Stats, Footers & Exhibits (`::stat[31M]{unit="+" caption="..."}`, `::footer[...]`, `:::visual[Label]`)**:
  Lower to `<ScoreReveal>`, `<p className="slide-footer-note">`, and `<SlideVisual>` (`data-pptx="raster"` `@2x` PNG island).

---

## 4. Writing Interactive Exhibits with Instant Final-State Handoff

Unlike Slidev's sequential click-from-slide-1 exporter, `slide-lib` loads slides
in parallel in their **final settled state** (`/?export=all` or `/:n?export=1`
with `prefers-reduced-motion: reduce`).

When building an animated React component (typing streams, step timelines,
animated charts):
1. Initialize React state to the **completed final state** (`phase = "static"`,
   `step = totalSteps`).
2. Call `const isFinalState = useSlideFinalState()` from `slide-lib`.
3. In your `useEffect` / `useLayoutEffect`, if `isFinalState` is `true`, return
   immediately so the component stays in its finished state on the very first
   frame with zero timers.

---

## 5. Bidirectional `HTML <-> PPTX` Commands

### Export a Vite Deck to an Editable `.pptx` (`HTML -> PPTX`)

```bash
npx slide-lib export --url http://localhost:5173 --out deck.pptx --title "Workshop Deck"
```

- Renders slides in a fixed `1920×1080` logical stage (`13.333" × 7.5"` 16:9
  widescreen in `.pptx`).
- Loads all slides in parallel via `/?export=all` (or a concurrent `/:n?export=1`
  worker pool).
- Converts headings, body copy, lists, eyebrows, and Shiki code blocks into
  **native editable PPTX text runs** (with a `+4%` width buffer so Google Slides
  imports without premature line wrapping).
- Preserves `<Em>` accents as rotated vector underline bars beneath the text.
- Captures `<SlideVisual>` (`[data-pptx="raster"]`) widgets as `@2x` transparent
  PNG islands.

### Import a `.pptx` Deck into MDX (`PPTX -> HTML/MDX`)

```bash
# Default: classify slides into semantic MDX primitives (ContextGrid, CapabilityMap, CodeCard, center)
npx slide-lib import ./presentation.pptx --out ./my-deck

# Exact fallback: preserve exact bounding-box coordinates using <CanvasSlide> and <CanvasBox>
npx slide-lib import ./presentation.pptx --out ./my-deck --exact
```
