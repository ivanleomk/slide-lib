import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	classifyPptxSlide,
	emitSlideMdx,
	importPptxToMdx,
	readPptxArchive,
} from "../src/index.ts";

const SAMPLE_PPTX_PATH = path.resolve(
	"tests/assets/pptx_roundtrip/sample_deck.pptx",
);

describe("PPTX -> MDX reader, semantic layout classifier, and exact CanvasSlide emitter", () => {
	test("reads OpenXML .pptx archive and normalizes slides, text runs, pictures, and speaker notes", async () => {
		const buf = fs.readFileSync(SAMPLE_PPTX_PATH);
		const slides = await readPptxArchive(buf);

		expect(
			slides.map((s) => ({
				slideNumber: s.slideNumber,
				backgroundColorHex: s.backgroundColorHex,
				textBoxCount: s.textBoxes.length,
				pictureCount: s.pictures.length,
				notes: s.notes,
			})),
		).toEqual([
			{
				slideNumber: 1,
				backgroundColorHex: "FAF8F3",
				textBoxCount: 2,
				pictureCount: 0,
				notes: "Cold open with the statement.",
			},
			{
				slideNumber: 2,
				backgroundColorHex: "FAF8F3",
				textBoxCount: 5,
				pictureCount: 1,
				notes: "Walk through the streamed turn and the trace visual.",
			},
			{
				slideNumber: 3,
				backgroundColorHex: "FAF8F3",
				textBoxCount: 8,
				pictureCount: 0,
				notes: "Compare the three model tiers.",
			},
		]);
	});

	test.each([
		{
			slideIndex: 0,
			expectedMdx: [
				"---",
				'title: "The benchmark is the bottleneck."',
				'layout: "center"',
				'notes: "Cold open with the statement."',
				"---",
				"",
				"# The benchmark is the *bottleneck*.",
				"",
				"You do not need evals to move fast. You need evals to keep moving fast.",
				"",
			].join("\n"),
		},
		{
			slideIndex: 1,
			expectedMdx: [
				"---",
				'title: "Every run, laid out in time"',
				'layout: "default"',
				'eyebrow: "01 · AI STUDIO"',
				'notes: "Walk through the streamed turn and the trace visual."',
				"---",
				"",
				"# Every run, laid out in *time*",
				"",
				"<ContextGrid>",
				"  <div>",
				"    Traces show where latency spikes and where calls fail in production.",
				"",
				'    <CodeCard label="interactions.py" code={"client.interactions.create(model=\\"gemini-2.5-pro\\")"} />',
				"  </div>",
				"  <div>",
				'    <img src="/imported/slide-2-img-1.png" alt="" />',
				"  </div>",
				"</ContextGrid>",
				"",
			].join("\n"),
		},
		{
			slideIndex: 2,
			expectedMdx: [
				"---",
				'title: "Three models, one API"',
				'layout: "default"',
				'eyebrow: "02 · MODELS"',
				'notes: "Compare the three model tiers."',
				"---",
				"",
				"# Three models, *one* API",
				"",
				"<CapabilityMap cols={3}>",
				'  <CapabilityCard model="2.5 Pro" summary="Deep reasoning and complex coding." />',
				'  <CapabilityCard model="2.5 Flash" summary="Workhorse model with controllable thinking." />',
				'  <CapabilityCard model="2.5 Flash-Lite" summary="High-volume, low-latency classification." />',
				"</CapabilityMap>",
				"",
			].join("\n"),
		},
	])(
		"classifies slide index $slideIndex into semantic MDX primitives",
		async ({ slideIndex, expectedMdx }) => {
			const buf = fs.readFileSync(SAMPLE_PPTX_PATH);
			const slides = await readPptxArchive(buf);
			const classified = classifyPptxSlide(slides[slideIndex], {
				mode: "semantic",
				theme: "warm-paper",
			});
			expect(emitSlideMdx(classified)).toEqual(expectedMdx);
		},
	);

	test("emits <CanvasSlide> with exact coordinates in --exact mode and writes assets to disk", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slide-lib-import-"));
		try {
			const result = await importPptxToMdx({
				pptxPath: SAMPLE_PPTX_PATH,
				outDir: tmpDir,
				mode: { mode: "exact", preserveFonts: true },
			});

			const slide1Mdx = fs.readFileSync(
				path.join(tmpDir, "content", "1.mdx"),
				"utf8",
			);
			expect({
				slideCount: result.slides.length,
				hasImageAsset: fs.existsSync(
					path.join(tmpDir, "public", "imported", "slide-2-img-1.png"),
				),
				slide1Mdx,
			}).toEqual({
				slideCount: 3,
				hasImageAsset: true,
				slide1Mdx: [
					"---",
					'title: "The benchmark is the bottleneck."',
					'layout: "canvas"',
					'notes: "Cold open with the statement."',
					"---",
					"",
					'<CanvasSlide background="#FAF8F3">',
					"  <CanvasBox x={462.2} y={473.5} w={1035.4} h={77}>",
					"    The benchmark is the *bottleneck*.",
					"  </CanvasBox>",
					"  <CanvasBox x={520.4} y={574.6} w={914.3} h={36}>",
					"    You do not need evals to move fast. You need evals to keep moving fast.",
					"  </CanvasBox>",
					"</CanvasSlide>",
					"",
				].join("\n"),
			});
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
