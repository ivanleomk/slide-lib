import { z } from "zod";

export const BoundingBoxSchema = z.object({
	x: z.number(),
	y: z.number(),
	w: z.number().nonnegative(),
	h: z.number().nonnegative(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const ExtractedTextRunSchema = z.object({
	text: z.string(),
	color: z.string(),
	fontFamily: z.string(),
	fontSizePx: z.number().positive(),
	bold: z.boolean().default(false),
	italic: z.boolean().default(false),
	isCode: z.boolean().default(false),
});

export type ExtractedTextRun = z.infer<typeof ExtractedTextRunSchema>;

export const ExtractedShapeSchema = z.object({
	kind: z.literal("shape"),
	bbox: BoundingBoxSchema,
	fillColor: z.string().nullable(),
	borderColor: z.string().nullable(),
	borderWidthPx: z.number().nonnegative().default(0),
	borderRadiusPx: z.number().nonnegative().default(0),
	rotateDeg: z.number().default(0),
	role: z.string().optional(),
});

export type ExtractedShape = z.infer<typeof ExtractedShapeSchema>;

export const ExtractedTextBlockSchema = z.object({
	kind: z.literal("text"),
	bbox: BoundingBoxSchema,
	align: z.enum(["left", "center", "right"]).default("left"),
	lineHeightPx: z.number().positive(),
	runs: z.array(ExtractedTextRunSchema).min(1),
	role: z.string().optional(),
});

export type ExtractedTextBlock = z.infer<typeof ExtractedTextBlockSchema>;

export const ExtractedImageSchema = z.object({
	kind: z.literal("image"),
	bbox: BoundingBoxSchema,
	src: z.string().min(1),
	isRasterIsland: z.boolean().default(false),
	label: z.string().optional(),
});

export type ExtractedImage = z.infer<typeof ExtractedImageSchema>;

export const ExtractedElementSchema = z.discriminatedUnion("kind", [
	ExtractedShapeSchema,
	ExtractedTextBlockSchema,
	ExtractedImageSchema,
]);

export type ExtractedElement = z.infer<typeof ExtractedElementSchema>;

export const ExtractedSlideSchema = z.object({
	slideNumber: z.number(),
	title: z.string().optional(),
	layout: z.string().default("default"),
	backgroundColor: z.string(),
	notes: z.string().optional(),
	elements: z.array(ExtractedElementSchema),
});

export type ExtractedSlide = z.infer<typeof ExtractedSlideSchema>;

export const ExtractedDeckSchema = z.object({
	title: z.string().default("Slide Deck"),
	slides: z.array(ExtractedSlideSchema),
});

export type ExtractedDeck = z.infer<typeof ExtractedDeckSchema>;

export function buildBrowserDomExtractorScript(): string {
	return `(rootEl, slideNumberFallback) => {
		const rootRect = rootEl.getBoundingClientRect();
		const relBox = (rect) => ({
			x: Math.round((rect.left - rootRect.left) * 10) / 10,
			y: Math.round((rect.top - rootRect.top) * 10) / 10,
			w: Math.round(rect.width * 10) / 10,
			h: Math.round(rect.height * 10) / 10,
		});

		const stage = rootEl.querySelector("[data-slide-stage]") || rootEl;
		const rootStyle = window.getComputedStyle(rootEl);
		const backgroundColor = rootStyle.backgroundColor || "rgb(250, 248, 243)";
		const slideNumberAttr = stage.getAttribute("data-slide-number");
		const slideNumber = slideNumberAttr ? Number.parseFloat(slideNumberAttr) : slideNumberFallback;
		const title = stage.getAttribute("data-slide-title") || undefined;
		const layout = stage.getAttribute("data-slide-layout") || "default";

		const elements = [];
		const rasterRoots = Array.from(stage.querySelectorAll('[data-pptx="raster"]'));
		const isInsideRaster = (node) => rasterRoots.some((r) => r.contains(node));

		const cardElements = Array.from(
			stage.querySelectorAll('[data-pptx-card], .code-card, .callout-box, .capability-col, .concept-card')
		);
		for (const el of cardElements) {
			if (isInsideRaster(el)) continue;
			const rect = el.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			const cs = window.getComputedStyle(el);
			const bg = cs.backgroundColor;
			const borderTopWidth = Number.parseFloat(cs.borderTopWidth) || 0;
			const borderLeftWidth = Number.parseFloat(cs.borderLeftWidth) || 0;
			const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
			if (hasBg || borderTopWidth > 0) {
				elements.push({
					kind: "shape",
					bbox: relBox(rect),
					fillColor: hasBg ? bg : null,
					borderColor: borderTopWidth > 0 ? cs.borderTopColor : null,
					borderWidthPx: borderTopWidth,
					borderRadiusPx: Number.parseFloat(cs.borderTopLeftRadius) || 0,
					rotateDeg: 0,
					role: el.getAttribute("data-pptx-card") || "card",
				});
			} else if (borderLeftWidth > 0) {
				elements.push({
					kind: "shape",
					bbox: { x: relBox(rect).x, y: relBox(rect).y, w: borderLeftWidth, h: relBox(rect).h },
					fillColor: cs.borderLeftColor,
					borderColor: null,
					borderWidthPx: 0,
					borderRadiusPx: 0,
					rotateDeg: 0,
					role: "divider",
				});
			}
		}

		const textSelectors = "h1, h2, h3, h4, p, li, figcaption, cite, pre, .model-name, .label, .callout-tag";
		const candidates = Array.from(stage.querySelectorAll(textSelectors));
		const textBlocks = candidates.filter((el) => {
			if (isInsideRaster(el)) return false;
			if (el.classList.contains("sr-only") || el.getAttribute("aria-hidden") === "true") return false;
			const hasNestedBlock = candidates.some((other) => other !== el && el.contains(other));
			return !hasNestedBlock;
		});

		for (const block of textBlocks) {
			const rect = block.getBoundingClientRect();
			if (rect.width < 1 || rect.height < 1) continue;
			const blockStyle = window.getComputedStyle(block);
			const runs = [];
			const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
			let textNode = walker.nextNode();
			while (textNode) {
				const rawText = textNode.nodeValue || "";
				if (rawText.length > 0) {
					const parent = textNode.parentElement || block;
					const ps = window.getComputedStyle(parent);
					const weight = Number.parseInt(ps.fontWeight, 10) || 400;
					const isCode =
						parent.tagName === "CODE" ||
						parent.tagName === "PRE" ||
						Boolean(parent.closest("pre, code"));
					runs.push({
						text: isCode ? rawText : rawText.replace(/\\s+/g, " "),
						color: ps.color || "rgb(55, 53, 47)",
						fontFamily: ps.fontFamily || "Newsreader",
						fontSizePx: Number.parseFloat(ps.fontSize) || 24,
						bold: weight >= 600,
						italic: ps.fontStyle === "italic",
						isCode,
					});
				}
				textNode = walker.nextNode();
			}

			if (runs.length > 0) {
				const align =
					blockStyle.textAlign === "center"
						? "center"
						: blockStyle.textAlign === "right"
							? "right"
							: "left";
				elements.push({
					kind: "text",
					bbox: relBox(rect),
					align,
					lineHeightPx:
						Number.parseFloat(blockStyle.lineHeight) ||
						(Number.parseFloat(blockStyle.fontSize) || 24) * 1.3,
					runs,
					role: block.getAttribute("data-pptx-role") || block.tagName.toLowerCase(),
				});
			}

			const emNodes = Array.from(block.querySelectorAll("em.em, span.em, [data-pptx-em='true']"));
			for (const em of emNodes) {
				const emRect = em.getBoundingClientRect();
				if (emRect.width < 2) continue;
				const barHeight = Math.max(3, Math.round(emRect.height * 0.09 * 10) / 10);
				const emRel = relBox(emRect);
				const accentVar =
					window.getComputedStyle(stage).getPropertyValue("--accent").trim() || "#b5522f";
				elements.push({
					kind: "shape",
					bbox: {
						x: emRel.x,
						y: Math.round((emRel.y + emRel.h - barHeight) * 10) / 10,
						w: emRel.w,
						h: barHeight,
					},
					fillColor: accentVar,
					borderColor: null,
					borderWidthPx: 0,
					borderRadiusPx: 2,
					rotateDeg: -0.8,
					role: "em-underline",
				});
			}
		}

		const images = Array.from(stage.querySelectorAll("img"));
		for (const img of images) {
			if (isInsideRaster(img)) continue;
			const rect = img.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			const src = img.currentSrc || img.getAttribute("src") || "";
			if (!src) continue;
			elements.push({
				kind: "image",
				bbox: relBox(rect),
				src,
				isRasterIsland: false,
				label: img.getAttribute("alt") || undefined,
			});
		}

		for (let idx = 0; idx < rasterRoots.length; idx++) {
			const island = rasterRoots[idx];
			const rect = island.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			elements.push({
				kind: "image",
				bbox: relBox(rect),
				src: "__raster_island_" + idx + "__",
				isRasterIsland: true,
				label: island.getAttribute("aria-label") || undefined,
			});
		}

		return {
			slideNumber,
			title,
			layout,
			backgroundColor,
			elements,
		};
	}`;
}
