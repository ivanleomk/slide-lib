// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
	CalloutBox,
	CalloutStack,
	CanvasBox,
	CanvasSlide,
	CapabilityCard,
	CapabilityMap,
	ConceptCard,
	ConceptGrid,
	ContextGrid,
	Deck,
	Em,
	SectionIndex,
	Slide,
	SlideVisual,
	resolveSectionEyebrow,
	resolveSlides,
	useSlideFinalState,
	type SectionRange,
	type SlideModule,
} from "../src/index.ts";

const WORKSHOP_SECTIONS: SectionRange[] = [
	{ label: "AI Studio", from: 3.5 },
	{ label: "How we got here", from: 6.5 },
	{ label: "Why customize", from: 11.5 },
	{ label: "Interactions API", from: 14.5 },
];

describe("resolveSectionEyebrow and resolveSlides", () => {
	test.each([
		{ slideNumber: 1, expected: undefined },
		{ slideNumber: 3, expected: undefined },
		{ slideNumber: 3.5, expected: "01 · AI Studio" },
		{ slideNumber: 5, expected: "01 · AI Studio" },
		{ slideNumber: 6.5, expected: "02 · How we got here" },
		{ slideNumber: 6.6, expected: "02 · How we got here" },
		{ slideNumber: 14.5, expected: "04 · Interactions API" },
		{ slideNumber: 16.5, expected: "04 · Interactions API" },
	])(
		"resolves section eyebrow for slide $slideNumber -> $expected",
		({ slideNumber, expected }) => {
			expect(resolveSectionEyebrow(slideNumber, WORKSHOP_SECTIONS)).toEqual(
				expected,
			);
		},
	);

	test("sorts integer and fractional MDX slide paths and resolves frontmatter", () => {
		const Dummy = () => null;
		const modules: Record<string, SlideModule> = {
			"../content/6.6.mdx": {
				default: Dummy,
				frontmatter: { title: "Sub-step B" },
			},
			"../content/1.mdx": {
				default: Dummy,
				frontmatter: { title: "Title", layout: "center" },
			},
			"../content/6.5.mdx": {
				default: Dummy,
				frontmatter: { title: "Sub-step A", eyebrow: "Custom Eyebrow" },
			},
			"../content/3.mdx": {
				default: Dummy,
				frontmatter: { title: "Section 1", layout: "section" },
			},
		};

		const resolved = resolveSlides(modules, WORKSHOP_SECTIONS).map(
			({ number, slug, layout, title, eyebrow }) => ({
				number,
				slug,
				layout,
				title,
				eyebrow,
			}),
		);

		expect(resolved).toEqual([
			{
				number: 1,
				slug: "1",
				layout: "center",
				title: "Title",
				eyebrow: undefined,
			},
			{
				number: 3,
				slug: "3",
				layout: "section",
				title: "Section 1",
				eyebrow: undefined,
			},
			{
				number: 6.5,
				slug: "6.5",
				layout: "default",
				title: "Sub-step A",
				eyebrow: "Custom Eyebrow",
			},
			{
				number: 6.6,
				slug: "6.6",
				layout: "default",
				title: "Sub-step B",
				eyebrow: "02 · How we got here",
			},
		]);
	});
});

describe("Deck navigation, fragments, and parallel export modes", () => {
	test("steps through [data-fragment] elements before advancing to the next slide", () => {
		const { container } = render(
			<Deck initialSlide={0}>
				<Slide slideNumber={1} title="First">
					<h1>Slide 1</h1>
					<p data-fragment="">Frag A</p>
					<p data-fragment="">Frag B</p>
				</Slide>
				<Slide slideNumber={2} title="Second">
					<h1>Slide 2</h1>
				</Slide>
			</Deck>,
		);

		const getVisibleFragments = () =>
			Array.from(container.querySelectorAll("[data-fragment].is-visible")).map(
				(el) => el.textContent,
			);

		expect(
			container.querySelector("[data-slide-number]")?.getAttribute("data-slide-number"),
		).toEqual("1");
		expect(getVisibleFragments()).toEqual([]);

		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(getVisibleFragments()).toEqual(["Frag A"]);

		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(getVisibleFragments()).toEqual(["Frag A", "Frag B"]);

		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(
			container.querySelector("[data-slide-number]")?.getAttribute("data-slide-number"),
		).toEqual("2");
	});

	test("renders all slides simultaneously in final state when exportMode='all'", () => {
		function ProbeWidget() {
			const isFinal = useSlideFinalState();
			return <span data-testid="final-flag">{isFinal ? "final" : "live"}</span>;
		}

		const { container } = render(
			<Deck exportMode="all" theme="studio-light">
				<Slide slideNumber={1} title="One">
					<ProbeWidget />
				</Slide>
				<Slide slideNumber={2} title="Two">
					<ProbeWidget />
				</Slide>
			</Deck>,
		);

		const frames = Array.from(
			container.querySelectorAll(".deck-slide.is-export-frame"),
		);
		const flags = Array.from(
			container.querySelectorAll("[data-testid='final-flag']"),
		).map((el) => el.textContent);

		expect({
			exportAttr: container
				.querySelector(".deck-export-all")
				?.getAttribute("data-export"),
			themeAttr: container
				.querySelector(".deck-export-all")
				?.getAttribute("data-theme"),
			frameCount: frames.length,
			flags,
		}).toEqual({
			exportAttr: "true",
			themeAttr: "studio-light",
			frameCount: 2,
			flags: ["final", "final"],
		});
	});
});

describe("MDX layout primitives emit deterministic data-pptx attributes", () => {
	test("renders semantic layout attributes for DOM -> PPTX extraction", () => {
		const { container } = render(
			<Slide layout="default" eyebrow="01 · AI Studio" slideNumber={4}>
				<h1>
					Build with <Em>confidence</Em>
				</h1>
				<ContextGrid variant="shot">
					<SectionIndex items={["Studio", "Evals"]} activeIndex={1} />
					<SlideVisual label="Interactive trace">
						<svg />
					</SlideVisual>
				</ContextGrid>
				<CapabilityMap cols={2}>
					<CapabilityCard model="2.5 Pro" summary="Deep reasoning" />
				</CapabilityMap>
				<ConceptGrid>
					<ConceptCard label="Step 1" title="Trace" summary="Capture spans" />
				</ConceptGrid>
				<CalloutStack>
					<CalloutBox tag="✓ Parity" title="Sandbox" variant="success">
						Real container
					</CalloutBox>
				</CalloutStack>
				<CanvasSlide>
					<CanvasBox x={120} y={80} w={400} h={100}>
						Positioned
					</CanvasBox>
				</CanvasSlide>
			</Slide>,
		);

		expect({
			eyebrowRole: container
				.querySelector(".slide-eyebrow")
				?.getAttribute("data-pptx-role"),
			emAttr: container.querySelector("em.em")?.getAttribute("data-pptx-em"),
			contextLayout: container
				.querySelector(".context-grid")
				?.getAttribute("data-pptx-layout"),
			visualMode: container
				.querySelector(".slide-visual")
				?.getAttribute("data-pptx"),
			capabilityCols: container
				.querySelector(".capability-map")
				?.getAttribute("data-pptx-cols"),
			activeSectionItem: container
				.querySelector(".section-index li.is-active")
				?.textContent,
			calloutVariant: container
				.querySelector(".callout-box")
				?.getAttribute("data-pptx-variant"),
			canvasBoxStyle: container
				.querySelector(".canvas-box")
				?.getAttribute("style"),
		}).toEqual({
			eyebrowRole: "eyebrow",
			emAttr: "true",
			contextLayout: "context-grid",
			visualMode: "raster",
			capabilityCols: "2",
			activeSectionItem: "Evals",
			calloutVariant: "success",
			canvasBoxStyle:
				"position: absolute; left: 120px; top: 80px; width: 400px; height: 100px;",
		});
	});
});
