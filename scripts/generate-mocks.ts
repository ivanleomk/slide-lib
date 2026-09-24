import fs from "node:fs";
import path from "node:path";
import type { ElementHandle } from "playwright";
import { STAGE_HEIGHT_PX, STAGE_WIDTH_PX } from "../src/export/color.ts";
import {
	ExtractedDeckSchema,
	ExtractedSlideSchema,
	buildBrowserDomExtractorScript,
	type ExtractedSlide,
} from "../src/export/dom-walker.ts";
import { launchSlideBrowser } from "../src/export/export-pptx.ts";
import { buildPptxBuffer } from "../src/export/pptx-builder.ts";

const SLIDE_FIXTURE_REQUEST = {
	title: "Benchmark Bottleneck Sample Deck",
	viewport: { width: STAGE_WIDTH_PX, height: STAGE_HEIGHT_PX, deviceScaleFactor: 2 },
	slides: [
		{
			slideNumber: 1,
			layout: "center",
			title: "The benchmark bottleneck",
			notes: "Cold open with the statement.",
			html: `
				<section class="deck-slide is-export-frame" style="width:1920px;height:1080px;padding:84px 128px;background:rgb(250, 248, 243);display:grid;align-items:center;box-sizing:border-box;font-family:Newsreader, Georgia, serif;">
					<article class="slide center" data-slide-stage="true" data-slide-layout="center" data-slide-number="1" data-slide-title="The benchmark bottleneck" style="--accent:#b5522f;text-align:center;display:flex;flex-direction:column;align-items:center;">
						<h1 style="margin:0;font-size:68px;font-weight:400;color:rgb(55, 53, 47);">The benchmark is the <em class="em" data-pptx-em="true" style="font-style:italic;color:rgb(55, 53, 47);">bottleneck</em>.</h1>
						<p style="margin:24px 0 0;font-size:28px;color:rgb(111, 108, 100);">You do not need evals to move fast. You need evals to keep moving fast.</p>
					</article>
				</section>
			`,
		},
		{
			slideNumber: 2,
			layout: "default",
			title: "The new Interactions API",
			notes: "Walk through the streamed turn and the trace visual.",
			html: `
				<section class="deck-slide is-export-frame" style="width:1920px;height:1080px;padding:84px 128px;background:rgb(250, 248, 243);display:grid;align-items:center;box-sizing:border-box;font-family:Newsreader, Georgia, serif;">
					<article class="slide" data-slide-stage="true" data-slide-layout="default" data-slide-number="2" data-slide-title="The new Interactions API" style="--accent:#b5522f;">
						<p class="slide-eyebrow" data-pptx-role="eyebrow" style="margin:0 0 18px;font-family:JetBrains Mono, monospace;font-size:15px;color:rgb(111, 108, 100);">01 · AI STUDIO</p>
						<h1 style="margin:0;font-size:64px;font-weight:400;color:rgb(55, 53, 47);">Every run, laid out in <em class="em" data-pptx-em="true" style="font-style:italic;color:rgb(55, 53, 47);">time</em></h1>
						<div class="context-grid" data-pptx-layout="context-grid" style="margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;">
							<div>
								<p style="margin:0 0 20px;font-size:26px;color:rgb(111, 108, 100);">Traces show where latency spikes and where calls fail in production.</p>
								<figure class="code-card" data-pptx-card="code" style="margin:0;border-radius:10px;background:rgb(24, 24, 24);padding:16px;">
									<figcaption class="code-card-label" style="font-family:JetBrains Mono, monospace;font-size:13px;color:rgb(158, 154, 144);margin-bottom:8px;">interactions.py</figcaption>
									<pre style="margin:0;font-family:JetBrains Mono, monospace;font-size:16px;"><code style="color:rgb(230, 225, 214);"><span style="color:rgb(203, 118, 118);">client</span>.interactions.create(model=<span style="color:rgb(152, 195, 121);">"gemini-2.5-pro"</span>)</code></pre>
								</figure>
							</div>
							<div class="slide-visual" data-pptx="raster" aria-label="Trace waterfall diagram" style="width:640px;height:280px;background:rgb(242, 239, 231);border-radius:12px;display:flex;align-items:center;justify-content:center;">
								<svg width="560" height="200" viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg">
									<rect x="20" y="30" width="480" height="36" rx="6" fill="#b5522f" />
									<rect x="80" y="90" width="320" height="36" rx="6" fill="#37352f" />
									<rect x="180" y="150" width="240" height="36" rx="6" fill="#6f6c64" />
								</svg>
							</div>
						</div>
					</article>
				</section>
			`,
		},
		{
			slideNumber: 3,
			layout: "default",
			title: "The Gemini 2.5 family",
			notes: "Compare the three model tiers.",
			html: `
				<section class="deck-slide is-export-frame" style="width:1920px;height:1080px;padding:84px 128px;background:rgb(250, 248, 243);display:grid;align-items:center;box-sizing:border-box;font-family:Newsreader, Georgia, serif;">
					<article class="slide" data-slide-stage="true" data-slide-layout="default" data-slide-number="3" data-slide-title="The Gemini 2.5 family" style="--accent:#b5522f;">
						<p class="slide-eyebrow" data-pptx-role="eyebrow" style="margin:0 0 18px;font-family:JetBrains Mono, monospace;font-size:15px;color:rgb(111, 108, 100);">02 · MODELS</p>
						<h1 style="margin:0;font-size:64px;font-weight:400;color:rgb(55, 53, 47);">Three models, <em class="em" data-pptx-em="true" style="font-style:italic;color:rgb(55, 53, 47);">one</em> API</h1>
						<div class="capability-map is-three" data-pptx-layout="capability-map" data-pptx-cols="3" style="margin-top:36px;display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;border-top:2px solid rgb(55, 53, 47);padding-top:24px;">
							<div class="capability-col" data-pptx-card="capability">
								<span class="model-name" style="font-family:JetBrains Mono, monospace;font-size:18px;font-weight:700;color:rgb(55, 53, 47);">2.5 Pro</span>
								<p style="margin:12px 0 0;font-size:22px;color:rgb(111, 108, 100);">Deep reasoning and complex coding.</p>
							</div>
							<div class="capability-col" data-pptx-card="capability">
								<span class="model-name" style="font-family:JetBrains Mono, monospace;font-size:18px;font-weight:700;color:rgb(55, 53, 47);">2.5 Flash</span>
								<p style="margin:12px 0 0;font-size:22px;color:rgb(111, 108, 100);">Workhorse model with controllable thinking.</p>
							</div>
							<div class="capability-col" data-pptx-card="capability">
								<span class="model-name" style="font-family:JetBrains Mono, monospace;font-size:18px;font-weight:700;color:rgb(55, 53, 47);">2.5 Flash-Lite</span>
								<p style="margin:12px 0 0;font-size:22px;color:rgb(111, 108, 100);">High-volume, low-latency classification.</p>
							</div>
						</div>
					</article>
				</section>
			`,
		},
	],
};

async function main() {
	const domDir = path.resolve("tests/assets/dom_extraction");
	const pptxDir = path.resolve("tests/assets/pptx_roundtrip");
	fs.mkdirSync(domDir, { recursive: true });
	fs.mkdirSync(pptxDir, { recursive: true });

	fs.writeFileSync(
		path.join(domDir, "request.json"),
		JSON.stringify(SLIDE_FIXTURE_REQUEST, null, 2),
	);

	const browser = await launchSlideBrowser();
	try {
		const context = await browser.newContext({
			viewport: { width: STAGE_WIDTH_PX, height: STAGE_HEIGHT_PX },
			deviceScaleFactor: 2,
			reducedMotion: "reduce",
		});
		const page = await context.newPage();
		const fullHtml = `<!doctype html><html><body style="margin:0">${SLIDE_FIXTURE_REQUEST.slides.map((s) => s.html).join("\n")}</body></html>`;
		await page.setContent(fullHtml, { waitUntil: "load" });

		const frames = await page.$$(".deck-slide.is-export-frame");
		const extractorSource = buildBrowserDomExtractorScript();
		const extractedSlides: ExtractedSlide[] = [];

		for (let i = 0; i < frames.length; i++) {
			const frame = frames[i] as ElementHandle<HTMLElement>;
			const spec = SLIDE_FIXTURE_REQUEST.slides[i];
			const raw = await frame.evaluate(
				new Function(
					"el",
					"n",
					`return (${extractorSource})(el, n);`,
				) as (el: HTMLElement, n: number) => unknown,
				spec.slideNumber,
			);
			const parsed = ExtractedSlideSchema.parse(raw);
			const islands = await frame.$$('[data-pptx="raster"]');
			const dataUris = await Promise.all(
				islands.map(async (island) => {
					const buf = await island.screenshot({ omitBackground: true });
					return `data:image/png;base64,${buf.toString("base64")}`;
				}),
			);
			extractedSlides.push({
				...parsed,
				notes: spec.notes,
				elements: parsed.elements.map((el) => {
					if (el.kind !== "image" || !el.isRasterIsland) return el;
					const m = el.src.match(/^__raster_island_(\d+)__$/);
					return m ? { ...el, src: dataUris[Number(m[1])] ?? el.src } : el;
				}),
			});
		}

		const jsonl = extractedSlides.map((s) => JSON.stringify(s)).join("\n") + "\n";
		fs.writeFileSync(path.join(domDir, "response.jsonl"), jsonl);

		const deck = ExtractedDeckSchema.parse({
			title: SLIDE_FIXTURE_REQUEST.title,
			slides: extractedSlides,
		});
		const pptxBuffer = await buildPptxBuffer(deck);
		fs.writeFileSync(path.join(pptxDir, "sample_deck.pptx"), pptxBuffer);
	} finally {
		await browser.close();
	}
}

main();
