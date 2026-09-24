import { MDXProvider } from "@mdx-js/react";
import {
	CalloutBox,
	CalloutStack,
	CapabilityCard,
	CapabilityMap,
	Clip,
	CodeCard,
	ConceptCard,
	ConceptGrid,
	ContextGrid,
	Deck,
	Em,
	 SectionIndex,
	Slide,
	SlideVisual,
	resolveSlides,
	type SlideModule,
} from "slide-lib";

const modules = import.meta.glob<SlideModule>("../content/*.mdx", { eager: true });
const slides = resolveSlides(modules, [{ label: "Overview", from: 2 }]);

const mdxComponents = {
	em: Em,
	ContextGrid,
	CapabilityMap,
	CapabilityCard,
	ConceptGrid,
	ConceptCard,
	SectionIndex,
	CalloutStack,
	CalloutBox,
	CodeCard,
	Clip,
	SlideVisual,
};

export function App() {
	return (
		<MDXProvider components={mdxComponents}>
			<Deck theme="warm-paper" titles={slides.map((s) => s.title)}>
				{slides.map(({ number, Component, layout, eyebrow, title }) => (
					<Slide key={number} slideNumber={number} layout={layout} eyebrow={eyebrow} title={title}>
						<Component />
					</Slide>
				))}
			</Deck>
		</MDXProvider>
	);
}
