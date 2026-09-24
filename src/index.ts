export {
	DeckConfigSchema,
	DeckThemeSchema,
	SectionRangeSchema,
	SlideFrontmatterSchema,
	SlideLayoutSchema,
	type DeckConfig,
	type DeckTheme,
	type SectionRange,
	type SlideFrontmatter,
	type SlideLayout,
} from "./schemas.ts";

export {
	resolveSectionEyebrow,
	resolveSlides,
	type ResolvedSlide,
	type SlideModule,
} from "./slides.ts";

export {
	Deck,
	STAGE_HEIGHT,
	STAGE_WIDTH,
	useSlideFinalState,
	type DeckProps,
	type ExportMode,
} from "./deck/Deck.tsx";

export { Slide, type SlideProps } from "./deck/Slide.tsx";
export { Em } from "./deck/Em.tsx";

export {
	CalloutBox,
	CalloutStack,
	CanvasBox,
	CanvasSlide,
	CapabilityCard,
	CapabilityMap,
	ConceptCard,
	ConceptGrid,
	ContextGrid,
	ScoreReveal,
	SectionIndex,
	SlideQuote,
	SlideVisual,
} from "./components/primitives.tsx";

export {
	CodeCard,
	getSlideHighlighter,
	type CodeCardProps,
} from "./components/CodeCard.tsx";

export { Clip } from "./components/Clip.tsx";
