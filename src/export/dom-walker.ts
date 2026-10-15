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
	rounded: z.boolean().default(false),
	label: z.string().optional(),
});

export type ExtractedImage = z.infer<typeof ExtractedImageSchema>;

export const ExtractedVideoSchema = z.object({
	kind: z.literal("video"),
	bbox: BoundingBoxSchema,
	src: z.string().min(1),
	videoPath: z.string().optional(),
	poster: z.string().optional(),
	label: z.string().optional(),
});

export type ExtractedVideo = z.infer<typeof ExtractedVideoSchema>;

export const ExtractedElementSchema = z.discriminatedUnion("kind", [
	ExtractedShapeSchema,
	ExtractedTextBlockSchema,
	ExtractedImageSchema,
	ExtractedVideoSchema,
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

		const accentVar =
			window.getComputedStyle(stage).getPropertyValue("--accent").trim() || "#b5522f";

		const cardElements = Array.from(
			stage.querySelectorAll('[data-pptx-card], .code-card, .callout-box, .capability-col, .concept-card, .capability-map, .concept-grid, .section-index, .section-index li')
		);
		for (const el of cardElements) {
			if (isInsideRaster(el)) continue;
			const rect = el.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			const cs = window.getComputedStyle(el);
			const bg = cs.backgroundColor;
			const borderTopWidth = Number.parseFloat(cs.borderTopWidth) || 0;
			const borderBottomWidth = Number.parseFloat(cs.borderBottomWidth) || 0;
			const borderLeftWidth = Number.parseFloat(cs.borderLeftWidth) || 0;
			const borderRightWidth = Number.parseFloat(cs.borderRightWidth) || 0;
			const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
			const isBoxBorder =
				borderTopWidth > 0 &&
				borderBottomWidth > 0 &&
				borderLeftWidth > 0 &&
				borderRightWidth > 0;
			const box = relBox(rect);
			if (hasBg || isBoxBorder) {
				elements.push({
					kind: "shape",
					bbox: box,
					fillColor: hasBg ? bg : null,
					borderColor: borderTopWidth > 0 ? cs.borderTopColor : null,
					borderWidthPx: borderTopWidth,
					borderRadiusPx: Number.parseFloat(cs.borderTopLeftRadius) || 0,
					rotateDeg: 0,
					role: el.getAttribute("data-pptx-card") || "card",
				});
			} else {
				if (borderTopWidth > 0) {
					elements.push({
						kind: "shape",
						bbox: { x: box.x, y: box.y, w: box.w, h: borderTopWidth },
						fillColor: cs.borderTopColor,
						borderColor: null,
						borderWidthPx: 0,
						borderRadiusPx: 0,
						rotateDeg: 0,
						role: "divider",
					});
				}
				if (borderBottomWidth > 0) {
					elements.push({
						kind: "shape",
						bbox: {
							x: box.x,
							y: Math.round((box.y + box.h - borderBottomWidth) * 10) / 10,
							w: box.w,
							h: borderBottomWidth,
						},
						fillColor: cs.borderBottomColor,
						borderColor: null,
						borderWidthPx: 0,
						borderRadiusPx: 0,
						rotateDeg: 0,
						role: "divider",
					});
				}
				if (borderLeftWidth > 0) {
					elements.push({
						kind: "shape",
						bbox: { x: box.x, y: box.y, w: borderLeftWidth, h: box.h },
						fillColor: cs.borderLeftColor,
						borderColor: null,
						borderWidthPx: 0,
						borderRadiusPx: 0,
						rotateDeg: 0,
						role: "divider",
					});
				}
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
				const rawBox = relBox(rect);
				const fontSizePx = Number.parseFloat(blockStyle.fontSize) || 24;
				if (block.matches(".section-index li") && block.parentElement) {
					const siblings = Array.from(block.parentElement.children).filter(
						(c) => c.tagName === "LI",
					);
					const liIdx = siblings.indexOf(block) + 1;
					if (liIdx > 0) {
						runs.unshift({
							text: String(liIdx).padStart(2, "0") + "   ",
							color: block.classList.contains("is-active")
								? accentVar
								: "rgb(111, 108, 100)",
							fontFamily: "JetBrains Mono",
							fontSizePx: 14,
							bold: false,
							italic: false,
							isCode: false,
						});
					}
				}
				if (block.matches(".capability-col li")) {
					const liPadL = Number.parseFloat(blockStyle.paddingLeft) || 0;
					if (liPadL > 0) {
						elements.push({
							kind: "shape",
							bbox: {
								x: rawBox.x,
								y: Math.round((rawBox.y + fontSizePx * 0.65) * 10) / 10,
								w: 9,
								h: 1.5,
							},
							fillColor: accentVar,
							borderColor: null,
							borderWidthPx: 0,
							borderRadiusPx: 0,
							rotateDeg: 0,
							role: "divider",
						});
						rawBox.x = Math.round((rawBox.x + liPadL) * 10) / 10;
						rawBox.w = Math.max(10, Math.round((rawBox.w - liPadL) * 10) / 10);
					}
				}
				const lineHeightPx =
					Number.parseFloat(blockStyle.lineHeight) ||
					Math.round(fontSizePx * 1.3 * 10) / 10;
				const align =
					blockStyle.textAlign === "center" ||
					(layout === "center" && block.parentElement === stage)
						? "center"
						: blockStyle.textAlign === "right"
							? "right"
							: "left";
				const parentEl = block.parentElement || stage;
				const parentCs = window.getComputedStyle(parentEl);
				const isHorizontalFlex =
					parentCs.display.includes("flex") &&
					!parentCs.flexDirection.startsWith("column");
				const isMultiColGrid =
					parentCs.display.includes("grid") &&
					parentCs.gridTemplateColumns.trim().split(/\\s+/).length > 1;
				const containerEl =
					isHorizontalFlex || isMultiColGrid ? block : parentEl;
				const containerCs = window.getComputedStyle(containerEl);
				const containerRect = containerEl.getBoundingClientRect();
				const padL =
					containerEl === block
						? 0
						: Number.parseFloat(containerCs.paddingLeft) || 0;
				const padR =
					containerEl === block
						? 0
						: Number.parseFloat(containerCs.paddingRight) || 0;
				const containerInnerLeft =
					Math.round((containerRect.left - rootRect.left + padL) * 10) / 10;
				const containerInnerRight =
					Math.round((containerRect.right - rootRect.left - padR) * 10) / 10;
				const isSingleLine = rawBox.h <= lineHeightPx * 1.5;

				let finalX = rawBox.x;
				let finalW = rawBox.w;
				if (align === "center") {
					const centerX = rawBox.x + rawBox.w / 2;
					const maxHalfW = Math.max(
						rawBox.w / 2,
						Math.min(
							centerX - containerInnerLeft,
							containerInnerRight - centerX,
						),
					);
					const maxSymW = Math.round(maxHalfW * 2 * 10) / 10;
					finalW = isSingleLine
						? maxSymW
						: Math.min(maxSymW, Math.round(rawBox.w * 1.12 * 10) / 10);
					finalX = Math.round((centerX - finalW / 2) * 10) / 10;
				} else if (align === "left") {
					const maxRightW = Math.max(
						rawBox.w,
						Math.round((containerInnerRight - rawBox.x) * 10) / 10,
					);
					finalW = isSingleLine
						? maxRightW
						: Math.min(maxRightW, Math.round(rawBox.w * 1.08 * 10) / 10);
				}

				elements.push({
					kind: "text",
					bbox: {
						x: finalX,
						y: rawBox.y,
						w: finalW,
						h: rawBox.h,
					},
					align,
					lineHeightPx,
					runs,
					role: block.getAttribute("data-pptx-role") || block.tagName.toLowerCase(),
				});
			}

			const emNodes = Array.from(block.querySelectorAll("em.em, span.em, [data-pptx-em='true']"));
			for (const em of emNodes) {
				const clientRects = Array.from(em.getClientRects()).filter(
					(r) => r.width >= 2 && r.height >= 2,
				);
				const rectsToUse =
					clientRects.length > 0 ? clientRects : [em.getBoundingClientRect()];
				for (const emRect of rectsToUse) {
					if (emRect.width < 2) continue;
					const barHeight = Math.max(3, Math.round(emRect.height * 0.08 * 10) / 10);
					const emRel = relBox(emRect);
					elements.push({
						kind: "shape",
						bbox: {
							x: emRel.x,
							y: Math.round((emRel.y + emRel.h + barHeight * 0.35) * 10) / 10,
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
		}

		const images = Array.from(stage.querySelectorAll("img"));
		for (const img of images) {
			if (isInsideRaster(img)) continue;
			const rect = img.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			const src = img.currentSrc || img.getAttribute("src") || "";
			if (!src) continue;
			const imgCs = window.getComputedStyle(img);
			const rawRadius = imgCs.borderTopLeftRadius || "0";
			const bRadius = Number.parseFloat(rawRadius) || 0;
			const isCircular = rawRadius.includes("%")
				? bRadius >= 40
				: bRadius >= Math.min(rect.width, rect.height) * 0.4;
			elements.push({
				kind: "image",
				bbox: relBox(rect),
				src,
				isRasterIsland: false,
				rounded: isCircular,
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

		const videoNodes = Array.from(stage.querySelectorAll("video, [data-pptx-video]"));
		for (const vid of videoNodes) {
			const rect = vid.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			const rawVideoSrc =
				vid.getAttribute("data-pptx-video") ||
				vid.currentSrc ||
				vid.getAttribute("src") ||
				(vid.querySelector("source") && vid.querySelector("source").getAttribute("src")) ||
				"";
			if (!rawVideoSrc) continue;
			const resolvedSrc = new URL(rawVideoSrc, window.location.href).href;
			const rawPoster =
				vid.getAttribute("data-pptx-poster") ||
				vid.getAttribute("poster") ||
				"";
			const resolvedPoster = rawPoster
				? new URL(rawPoster, window.location.href).href
				: undefined;
			elements.push({
				kind: "video",
				bbox: relBox(rect),
				src: resolvedSrc,
				videoPath: rawVideoSrc,
				poster: resolvedPoster,
				label: vid.getAttribute("aria-label") || undefined,
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
