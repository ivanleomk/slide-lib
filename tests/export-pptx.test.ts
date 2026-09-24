import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { describe, expect, test } from "vitest";
import {
	ExtractedSlideSchema,
	buildPptxBuffer,
	normalizeCssColor,
	normalizeFontFamily,
	pxToInchesX,
	pxToInchesY,
	pxToPt,
	type ExtractedSlide,
} from "../src/index.ts";

function loadRecordedSlides(): ExtractedSlide[] {
	const jsonlPath = path.resolve("tests/assets/dom_extraction/response.jsonl");
	return fs
		.readFileSync(jsonlPath, "utf8")
		.trim()
		.split("\n")
		.map((line) => ExtractedSlideSchema.parse(JSON.parse(line)));
}

describe("Color and coordinate normalization for Google Slides / PowerPoint", () => {
	test.each([
		{
			input: "rgb(250, 248, 243)",
			expected: { hex: "FAF8F3", alpha: 1 },
		},
		{
			input: "#b5522f",
			expected: { hex: "B5522F", alpha: 1 },
		},
		{
			input: "rgb(55 53 47 / 0.14)",
			expected: { hex: "37352F", alpha: 0.14 },
		},
		{
			input: "oklch(0.62 0.15 35)",
			expected: { hex: "D05F43", alpha: 1 },
		},
		{
			input: "transparent",
			expected: null,
		},
	])("normalizes CSS color $input -> $expected", ({ input, expected }) => {
		expect(normalizeCssColor(input)).toEqual(expected);
	});

	test.each([
		{
			px: { x: 1920, y: 1080, font: 68 },
			expected: { xIn: 13.333, yIn: 7.5, pt: 51 },
		},
		{
			px: { x: 128, y: 84, font: 28 },
			expected: { xIn: 0.889, yIn: 0.583, pt: 21 },
		},
		{
			px: { x: 960, y: 540, font: 16 },
			expected: { xIn: 6.667, yIn: 3.75, pt: 12 },
		},
	])(
		"maps 1920x1080 stage coordinates $px to 16:9 widescreen inches and points",
		({ px, expected }) => {
			expect({
				xIn: pxToInchesX(px.x),
				yIn: pxToInchesY(px.y),
				pt: pxToPt(px.font),
			}).toEqual(expected);
		},
	);

	test.each([
		{
			raw: '"Newsreader", Georgia, serif',
			expected: "Newsreader",
		},
		{
			raw: '"SF Mono", "JetBrains Mono", monospace',
			expected: "JetBrains Mono",
		},
		{
			raw: "ui-sans-serif, system-ui, sans-serif",
			expected: "Inter",
		},
	])("normalizes font stack $raw -> $expected", ({ raw, expected }) => {
		expect(normalizeFontFamily(raw)).toEqual(expected);
	});
});

describe("HTML -> PPTX builder from recorded Playwright DOM extraction fixtures", () => {
	const recordedSlides = loadRecordedSlides();

	test.each([
		{
			index: 0,
			expectedSummary: {
				slideNumber: 1,
				layout: "center",
				title: "The benchmark bottleneck",
				roles: ["h1", "em-underline", "p"],
				h1Runs: [
					{ text: "The benchmark is the ", italic: false },
					{ text: "bottleneck", italic: true },
					{ text: ".", italic: false },
				],
			},
		},
		{
			index: 1,
			expectedSummary: {
				slideNumber: 2,
				layout: "default",
				title: "The new Interactions API",
				roles: [
					"code",
					"eyebrow",
					"h1",
					"em-underline",
					"p",
					"figcaption",
					"pre",
					"image:Trace waterfall diagram",
				],
				h1Runs: [
					{ text: "Every run, laid out in ", italic: false },
					{ text: "time", italic: true },
				],
			},
		},
		{
			index: 2,
			expectedSummary: {
				slideNumber: 3,
				layout: "default",
				title: "The Gemini 2.5 family",
				roles: [
					"eyebrow",
					"h1",
					"em-underline",
					"span",
					"p",
					"span",
					"p",
					"span",
					"p",
				],
				h1Runs: [
					{ text: "Three models, ", italic: false },
					{ text: "one", italic: true },
					{ text: " API", italic: false },
				],
			},
		},
	])(
		"validates recorded slide $expectedSummary.slideNumber ($expectedSummary.title) structure",
		({ index, expectedSummary }) => {
			const slide = recordedSlides[index];
			const h1 = slide.elements.find(
				(e) => e.kind === "text" && e.role === "h1",
			);
			expect({
				slideNumber: slide.slideNumber,
				layout: slide.layout,
				title: slide.title,
				roles: slide.elements.map((e) =>
					e.kind === "image" ? `image:${e.label}` : e.role,
				),
				h1Runs:
					h1 && h1.kind === "text"
						? h1.runs.map((r) => ({ text: r.text, italic: r.italic }))
						: [],
			}).toEqual(expectedSummary);
		},
	);

	test("generates an OpenXML .pptx archive with editable text runs, Shiki token colors, shapes, notes, and @2x PNG island", async () => {
		const pptxBuf = await buildPptxBuffer({
			title: "Benchmark Bottleneck Sample Deck",
			slides: recordedSlides,
		});

		const zip = await JSZip.loadAsync(pptxBuf);
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			trimValues: false,
			isArray: (name) => ["p:sp", "p:pic", "a:p", "a:r"].includes(name),
		});

		const slide2Xml = await zip.file("ppt/slides/slide2.xml")?.async("string");
		const notes1Xml = await zip
			.file("ppt/notesSlides/notesSlide1.xml")
			?.async("string");
		expect(Boolean(slide2Xml)).toEqual(true);
		expect(Boolean(notes1Xml)).toEqual(true);

		const parsedSlide2 = parser.parse(slide2Xml!);
		const spTree = parsedSlide2["p:sld"]["p:cSld"]["p:spTree"];
		const shapes = spTree["p:sp"] as Record<string, unknown>[];
		const pics = spTree["p:pic"] as Record<string, unknown>[];

		const allTextRuns = shapes.flatMap((sp: any) => {
			const paragraphs = sp["p:txBody"]?.["a:p"] ?? [];
			return paragraphs.flatMap((p: any) =>
				(p["a:r"] ?? []).map((r: any) => ({
					text: r["a:t"],
					color: r["a:rPr"]?.["a:solidFill"]?.["a:srgbClr"]?.["@_val"],
				})),
			);
		});

		expect({
			slideCount: Object.keys(zip.files).filter((f) =>
				/^ppt\/slides\/slide\d+\.xml$/.test(f),
			).length,
			mediaFiles: Object.keys(zip.files).filter((f) =>
				f.startsWith("ppt/media/"),
			),
			slide2PictureCount: pics.length,
			codeTokenRuns: allTextRuns.filter((r) =>
				["client", '"gemini-2.5-pro"'].includes(r.text),
			),
		}).toEqual({
			slideCount: 3,
			mediaFiles: ["ppt/media/", "ppt/media/image-2-1.png"],
			slide2PictureCount: 1,
			codeTokenRuns: [
				{ text: "client", color: "CB7676" },
				{ text: '"gemini-2.5-pro"', color: "98C379" },
			],
		});
	});
});
