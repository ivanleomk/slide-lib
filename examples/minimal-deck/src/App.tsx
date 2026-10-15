import { Deck, Slide, resolveSlides, type SlideModule } from "slide-lib";

const modules = import.meta.glob<SlideModule>("../content/*.mdx", { eager: true });
const slides = resolveSlides(modules, [{ label: "Overview", from: 2 }]);

export function App() {
	return (
		<Deck theme="warm-paper" titles={slides.map((s) => s.title)}>
			{slides.map(({ number, Component, layout, eyebrow, title }) => (
				<Slide key={number} slideNumber={number} layout={layout} eyebrow={eyebrow} title={title}>
					<Component />
				</Slide>
			))}
		</Deck>
	);
}
