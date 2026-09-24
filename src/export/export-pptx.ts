import fs from "node:fs";
import { chromium, type Browser, type ElementHandle } from "playwright";
import { z } from "zod";
import { STAGE_HEIGHT_PX, STAGE_WIDTH_PX } from "./color.ts";
import {
	ExtractedDeckSchema,
	ExtractedSlideSchema,
	buildBrowserDomExtractorScript,
	type ExtractedDeck,
	type ExtractedSlide,
} from "./dom-walker.ts";
import { buildPptxBuffer } from "./pptx-builder.ts";

export const ExportPptxConfigSchema = z.object({
	url: z.string().url(),
	outPath: z.string().min(1),
	title: z.string().default("Slide Deck"),
	concurrency: z.number().int().min(1).max(16).default(6),
	slideCount: z.number().int().positive().optional(),
});

export type ExportPptxConfig = z.infer<typeof ExportPptxConfigSchema>;

export async function launchSlideBrowser(): Promise<Browser> {
	try {
		return await chromium.launch({ channel: "chrome" });
	} catch {
		return await chromium.launch();
	}
}

async function captureRasterIslands(
	stageRoot: ElementHandle<HTMLElement>,
	slide: ExtractedSlide,
): Promise<ExtractedSlide> {
	const islands = await stageRoot.$$('[data-pptx="raster"]');
	if (islands.length === 0) return slide;

	const dataUris = await Promise.all(
		islands.map(async (handle) => {
			const pngBuf = await handle.screenshot({ omitBackground: true });
			return `data:image/png;base64,${pngBuf.toString("base64")}`;
		}),
	);

	return {
		...slide,
		elements: slide.elements.map((el) => {
			if (el.kind !== "image" || !el.isRasterIsland) return el;
			const match = el.src.match(/^__raster_island_(\d+)__$/);
			if (!match) return el;
			const idx = Number.parseInt(match[1], 10);
			return {
				...el,
				src: dataUris[idx] ?? el.src,
			};
		}),
	};
}

export async function extractDeckFromUrl(
	rawConfig: Omit<ExportPptxConfig, "outPath">,
): Promise<ExtractedDeck> {
	const config = ExportPptxConfigSchema.omit({ outPath: true }).parse(rawConfig);
	const browser = await launchSlideBrowser();

	try {
		const context = await browser.newContext({
			viewport: { width: STAGE_WIDTH_PX, height: STAGE_HEIGHT_PX },
			deviceScaleFactor: 2,
			reducedMotion: "reduce",
		});

		const baseUrl = config.url.replace(/\/+$/, "");
		const probePage = await context.newPage();
		await probePage.goto(`${baseUrl}/?export=all`, { waitUntil: "networkidle" });
		await probePage.evaluate(() => document.fonts.ready);

		const exportFrames = await probePage.$$(".deck-slide.is-export-frame");
		const extractorFnSource = buildBrowserDomExtractorScript();

		if (exportFrames.length > 0) {
			const slides = await Promise.all(
				exportFrames.map(async (frameHandle, idx) => {
					const raw = await frameHandle.evaluate(
						new Function(
							"el",
							"n",
							`return (${extractorFnSource})(el, n);`,
						) as (el: HTMLElement, n: number) => unknown,
						idx + 1,
					);
					const parsed = ExtractedSlideSchema.parse(raw);
					return captureRasterIslands(
						frameHandle as ElementHandle<HTMLElement>,
						parsed,
					);
				}),
			);
			await probePage.close();
			return ExtractedDeckSchema.parse({
				title: config.title,
				slides,
			});
		}

		const detectedCount =
			config.slideCount ??
			(await probePage.evaluate(() => {
				const label =
					document
						.querySelector(".deck-slide")
						?.getAttribute("aria-label") ?? "";
				const match = label.match(/Slide\s+\d+\s+of\s+(\d+)/i);
				return match ? Number.parseInt(match[1], 10) : 1;
			}));
		await probePage.close();

		const slideNumbers = Array.from(
			{ length: detectedCount },
			(_, idx) => idx + 1,
		);
		const slides: ExtractedSlide[] = new Array(detectedCount);

		const workerCount = Math.min(config.concurrency, detectedCount);
		let cursor = 0;

		await Promise.all(
			Array.from({ length: workerCount }, async () => {
				const page = await context.newPage();
				while (cursor < slideNumbers.length) {
					const currentIdx = cursor++;
					const slideNum = slideNumbers[currentIdx];
					await page.goto(`${baseUrl}/${slideNum}?export=1`, {
						waitUntil: "networkidle",
					});
					await page.evaluate(() => document.fonts.ready);
					const stageHandle = (await page.$(".deck-slide")) as ElementHandle<HTMLElement> | null;
					if (!stageHandle) {
						throw new Error(`Missing .deck-slide on slide ${slideNum}`);
					}
					const raw = await stageHandle.evaluate(
						new Function(
							"el",
							"n",
							`return (${extractorFnSource})(el, n);`,
						) as (el: HTMLElement, n: number) => unknown,
						slideNum,
					);
					const parsed = ExtractedSlideSchema.parse(raw);
					slides[currentIdx] = await captureRasterIslands(stageHandle, parsed);
				}
				await page.close();
			}),
		);

		return ExtractedDeckSchema.parse({
			title: config.title,
			slides,
		});
	} finally {
		await browser.close();
	}
}

export async function exportDeckToPptx(
	rawConfig: ExportPptxConfig,
): Promise<ExtractedDeck> {
	const config = ExportPptxConfigSchema.parse(rawConfig);
	const deck = await extractDeckFromUrl({
		url: config.url,
		title: config.title,
		concurrency: config.concurrency,
		slideCount: config.slideCount,
	});
	const buffer = await buildPptxBuffer(deck);
	fs.writeFileSync(config.outPath, buffer);
	return deck;
}
