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

export {
	PPTX_HEIGHT_INCHES,
	PPTX_WIDTH_INCHES,
	STAGE_HEIGHT_PX,
	STAGE_WIDTH_PX,
	normalizeCssColor,
	normalizeFontFamily,
	pxToInchesX,
	pxToInchesY,
	pxToPt,
	type NormalizedColor,
} from "./export/color.ts";

export {
	BoundingBoxSchema,
	ExtractedDeckSchema,
	ExtractedElementSchema,
	ExtractedImageSchema,
	ExtractedShapeSchema,
	ExtractedSlideSchema,
	ExtractedTextBlockSchema,
	ExtractedTextRunSchema,
	buildBrowserDomExtractorScript,
	type BoundingBox,
	type ExtractedDeck,
	type ExtractedElement,
	type ExtractedImage,
	type ExtractedShape,
	type ExtractedSlide,
	type ExtractedTextBlock,
	type ExtractedTextRun,
} from "./export/dom-walker.ts";

export {
	addExtractedSlideToPptx,
	buildPptxBuffer,
} from "./export/pptx-builder.ts";

export {
	ExportPptxConfigSchema,
	exportDeckToPptx,
	extractDeckFromUrl,
	launchSlideBrowser,
	type ExportPptxConfig,
} from "./export/export-pptx.ts";

export {
	PptxPictureSchema,
	PptxSlideRecordSchema,
	PptxTextBoxSchema,
	PptxTextRunSchema,
	readPptxArchive,
	type PptxPicture,
	type PptxSlideRecord,
	type PptxTextBox,
	type PptxTextRun,
} from "./import/pptx-reader.ts";

export {
	ClassifiedSlideSchema,
	ImportModeSchema,
	SemanticBodyBlockSchema,
	classifyPptxSlide,
	runsToMarkdown,
	runsToPlainText,
	type ClassifiedSlide,
	type ImportMode,
	type SemanticBodyBlock,
} from "./import/layout-classifier.ts";

export {
	ImportPptxConfigSchema,
	emitSlideMdx,
	importPptxToMdx,
	type ImportPptxConfig,
} from "./import/mdx-emitter.ts";

export {
	ScaffoldDeckConfigSchema,
	scaffoldSlideDeck,
	type ScaffoldDeckConfig,
} from "./scaffold/init.ts";
