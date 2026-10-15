import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import {
	STAGE_HEIGHT_PX,
	STAGE_WIDTH_PX,
	normalizeCssColor,
	normalizeFontFamily,
	pxToInchesX,
	pxToInchesY,
	pxToPt,
} from "./color.ts";
import {
	ExtractedDeckSchema,
	type BoundingBox,
	type ExtractedDeck,
	type ExtractedElement,
	type ExtractedSlide,
	type ExtractedTextBlock,
	type ExtractedTextRun,
} from "./dom-walker.ts";

const STAGE_SIDE_MARGIN_PX = 128;

export function estimateSingleLineWidthPx(runs: ExtractedTextRun[]): number {
	let currentLineWidth = 0;
	let maxLineWidth = 0;
	for (const run of runs) {
		const lowerFont = run.fontFamily.toLowerCase();
		const isMono =
			run.isCode ||
			lowerFont.includes("mono") ||
			lowerFont.includes("consolas") ||
			lowerFont.includes("menlo");
		const lines = run.text.split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			if (i > 0) {
				maxLineWidth = Math.max(maxLineWidth, currentLineWidth);
				currentLineWidth = 0;
			}
			const segment = lines[i];
			for (const ch of segment) {
				const factor = isMono
					? 0.62
					: /[ .,;:!'|·\-]/.test(ch)
						? 0.25
						: /[A-Z]/.test(ch)
							? 0.58
							: run.bold
								? 0.48
								: run.italic
									? 0.42
									: 0.45;
				currentLineWidth += run.fontSizePx * factor;
			}
		}
	}
	return Math.round(Math.max(maxLineWidth, currentLineWidth) * 10) / 10;
}

interface ResolvedTextLayout {
	bbox: BoundingBox;
	align: "left" | "center" | "right";
	yOffsetPx: number;
}

function resolveSlideElementsLayout(
	rawSlide: ExtractedSlide,
): ExtractedElement[] {
	const elements = rawSlide.elements.map((el) => ({
		...el,
		bbox: { ...el.bbox },
	}));

	const textEntries: {
		index: number;
		el: ExtractedTextBlock;
		origBbox: BoundingBox;
		resolved: ResolvedTextLayout;
	}[] = [];

	for (let idx = 0; idx < elements.length; idx++) {
		const el = elements[idx];
		if (el.kind !== "text") continue;
		const origBbox = { ...el.bbox };
		const centerX = origBbox.x + origBbox.w / 2;
		const isCenteredOnStage =
			rawSlide.layout === "center" &&
			Math.abs(centerX - STAGE_WIDTH_PX / 2) <= 140;
		const effectiveAlign: "left" | "center" | "right" =
			el.align === "center" || isCenteredOnStage ? "center" : el.align;

		const hasNewline = el.runs.some((r) => r.text.includes("\n"));
		const chromeLines = Math.max(
			1,
			Math.round(origBbox.h / Math.max(1, el.lineHeightPx)),
		);
		const isSingleLine = chromeLines === 1 && !hasNewline;
		const estSingleLineWidthPx = estimateSingleLineWidthPx(el.runs);

		let finalX = origBbox.x;
		let finalW = origBbox.w;

		if (effectiveAlign === "center") {
			const maxHalfW = Math.max(
				origBbox.w / 2,
				Math.min(
					centerX - STAGE_SIDE_MARGIN_PX,
					STAGE_WIDTH_PX - STAGE_SIDE_MARGIN_PX - centerX,
				),
			);
			const maxSymW = Math.round(maxHalfW * 2 * 10) / 10;
			if (isSingleLine) {
				finalW = Math.min(
					maxSymW,
					Math.max(origBbox.w * 1.25, estSingleLineWidthPx * 1.15, maxSymW),
				);
			} else {
				finalW = Math.min(
					maxSymW,
					Math.max(
						origBbox.w * 1.06,
						(estSingleLineWidthPx / chromeLines) * 1.08,
					),
				);
			}
			finalW = Math.round(finalW * 10) / 10;
			finalX = Math.round(Math.max(32, centerX - finalW / 2) * 10) / 10;
		} else if (effectiveAlign === "left") {
			const stageRightEdge =
				origBbox.w < 900
					? STAGE_WIDTH_PX - 80
					: STAGE_WIDTH_PX - STAGE_SIDE_MARGIN_PX;
			let rightLimitPx = stageRightEdge;
			for (let j = 0; j < elements.length; j++) {
				if (j === idx) continue;
				const other = elements[j];
				if (other.kind === "shape" && other.role === "em-underline") continue;
				const vOverlap =
					Math.min(origBbox.y + origBbox.h, other.bbox.y + other.bbox.h) -
					Math.max(origBbox.y, other.bbox.y);
				if (vOverlap <= 4) continue;
				if (other.bbox.x >= origBbox.x + origBbox.w - 8) {
					rightLimitPx = Math.min(rightLimitPx, other.bbox.x - 12);
				} else if (
					other.kind === "shape" &&
					other.role !== "divider" &&
					other.bbox.x <= origBbox.x &&
					other.bbox.x + other.bbox.w >= origBbox.x + origBbox.w
				) {
					rightLimitPx = Math.min(
						rightLimitPx,
						other.bbox.x + other.bbox.w - 16,
					);
				}
			}
			const maxAvailW = Math.max(origBbox.w, rightLimitPx - origBbox.x);
			finalW = isSingleLine
				? Math.min(
						maxAvailW,
						Math.max(origBbox.w * 1.15, estSingleLineWidthPx * 1.12),
					)
				: Math.min(maxAvailW, origBbox.w * 1.06);
			finalW = Math.round(finalW * 10) / 10;
		} else {
			finalW = Math.round(origBbox.w * 1.12 * 10) / 10;
			finalX = Math.round(Math.max(32, origBbox.x + origBbox.w - finalW) * 10) / 10;
		}

		const isCodeBlock = el.runs.some((r) => r.isCode);
		const estimatedLines = isCodeBlock
			? chromeLines
			: Math.max(
					chromeLines,
					Math.ceil((estSingleLineWidthPx * 0.96) / Math.max(1, finalW)),
				);
		const finalH =
			Math.round(Math.max(origBbox.h, estimatedLines * el.lineHeightPx) * 10) /
			10;

		textEntries.push({
			index: idx,
			el,
			origBbox,
			resolved: {
				bbox: { x: finalX, y: origBbox.y, w: finalW, h: finalH },
				align: effectiveAlign,
				yOffsetPx: 0,
			},
		});
	}

	const ordered = [...textEntries].sort(
		(a, b) => a.origBbox.y - b.origBbox.y || a.origBbox.x - b.origBbox.x,
	);

	for (let i = 0; i < ordered.length; i++) {
		const upper = ordered[i];
		const upperTop = upper.origBbox.y + upper.resolved.yOffsetPx;
		const upperBottom = upperTop + upper.resolved.bbox.h;
		const origUpperBottom = upper.origBbox.y + upper.origBbox.h;

		if (upperBottom <= origUpperBottom + 1) continue;

		for (let j = i + 1; j < ordered.length; j++) {
			const lower = ordered[j];
			if (lower.origBbox.y < origUpperBottom - 8) continue;
			const hOverlap =
				Math.min(
					upper.resolved.bbox.x + upper.resolved.bbox.w,
					lower.resolved.bbox.x + lower.resolved.bbox.w,
				) - Math.max(upper.resolved.bbox.x, lower.resolved.bbox.x);
			if (hOverlap <= 24) continue;

			const origGap = Math.max(10, lower.origBbox.y - origUpperBottom);
			const preservedGap = Math.min(origGap, 24);
			const requiredTop = upperBottom + preservedGap;
			const currentLowerTop = lower.origBbox.y + lower.resolved.yOffsetPx;
			if (currentLowerTop < requiredTop) {
				lower.resolved.yOffsetPx =
					Math.round((requiredTop - lower.origBbox.y) * 10) / 10;
			}
		}
	}

	for (const entry of textEntries) {
		const target = elements[entry.index] as ExtractedTextBlock;
		target.align = entry.resolved.align;
		target.bbox = {
			x: entry.resolved.bbox.x,
			y:
				Math.round((entry.origBbox.y + entry.resolved.yOffsetPx) * 10) / 10,
			w: entry.resolved.bbox.w,
			h: Math.min(
				entry.resolved.bbox.h,
				Math.max(
					entry.resolved.bbox.h,
					STAGE_HEIGHT_PX - (entry.origBbox.y + entry.resolved.yOffsetPx) - 16,
				),
			),
		};

		if (entry.resolved.yOffsetPx !== 0) {
			for (const other of elements) {
				if (other.kind !== "shape" || other.role !== "em-underline") continue;
				if (
					other.bbox.y >= entry.origBbox.y - 4 &&
					other.bbox.y <= entry.origBbox.y + entry.origBbox.h + 12 &&
					other.bbox.x + other.bbox.w >= entry.resolved.bbox.x &&
					other.bbox.x <= entry.resolved.bbox.x + entry.resolved.bbox.w
				) {
					other.bbox.y =
						Math.round((other.bbox.y + entry.resolved.yOffsetPx) * 10) / 10;
				}
			}
		}
	}

	return elements;
}

export function sanitizeSlideOpenXml(slideXml: string): string {
	const dedupedPPr = slideXml.replace(
		/<a:p>([\s\S]*?)<\/a:p>/g,
		(_full, inner: string) => {
			let seenFirstPPr = false;
			const cleanedInner = inner.replace(
				/<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g,
				(match) => {
					if (!seenFirstPPr) {
						seenFirstPPr = true;
						return match;
					}
					return "";
				},
			);
			return `<a:p>${cleanedInner}</a:p>`;
		},
	);

	return dedupedPPr
		.replace(
			/typeface="(Newsreader|Georgia|Times New Roman)" pitchFamily="34"/g,
			'typeface="$1" pitchFamily="18"',
		)
		.replace(
			/typeface="(JetBrains Mono|Courier New)" pitchFamily="34"/g,
			'typeface="$1" pitchFamily="49"',
		);
}

export function addExtractedSlideToPptx(
	pptx: PptxGenJS,
	rawSlide: ExtractedSlide,
): void {
	const slide = pptx.addSlide();
	const bg = normalizeCssColor(rawSlide.backgroundColor);
	if (bg) {
		slide.background = { color: bg.hex };
	}

	if (rawSlide.notes) {
		slide.addNotes(rawSlide.notes);
	}

	const resolvedElements = resolveSlideElementsLayout(rawSlide);

	for (const element of resolvedElements) {
		const x = pxToInchesX(element.bbox.x);
		const y = pxToInchesY(element.bbox.y);
		const w = pxToInchesX(element.bbox.w);
		const h = pxToInchesY(element.bbox.h);

		if (element.kind === "shape") {
			const fill = normalizeCssColor(element.fillColor);
			const border = normalizeCssColor(element.borderColor);
			const isRounded = element.borderRadiusPx >= 4;
			const shapeType = isRounded
				? pptx.ShapeType.roundRect
				: pptx.ShapeType.rect;

			slide.addShape(shapeType, {
				x,
				y,
				w,
				h,
				fill: fill
					? {
							color: fill.hex,
							transparency: Math.round((1 - fill.alpha) * 100),
						}
					: undefined,
				line:
					border && element.borderWidthPx > 0
						? {
								color: border.hex,
								width: pxToPt(element.borderWidthPx),
								transparency: Math.round((1 - border.alpha) * 100),
							}
						: undefined,
				rectRadius: isRounded ? 0.08 : undefined,
				rotate: element.rotateDeg !== 0 ? element.rotateDeg : undefined,
			});
			continue;
		}

		if (element.kind === "text") {
			const textRuns: PptxGenJS.TextProps[] = element.runs.map((run) => {
				const color = normalizeCssColor(run.color);
				return {
					text: run.text,
					options: {
						fontFace: normalizeFontFamily(run.fontFamily),
						fontSize: pxToPt(run.fontSizePx),
						color: color?.hex ?? "37352F",
						bold: run.bold,
						italic: run.italic,
					},
				};
			});

			slide.addText(textRuns, {
				x,
				y,
				w,
				h: Math.max(h, 0.12),
				align: element.align,
				valign: "top",
				margin: 0,
				lineSpacing: pxToPt(element.lineHeightPx),
			});
			continue;
		}

		if (element.kind === "image") {
			const isDataUri = element.src.startsWith("data:");
			slide.addImage({
				...(isDataUri ? { data: element.src } : { path: element.src }),
				x,
				y,
				w,
				h,
			});
		}
	}
}

export async function buildPptxBuffer(rawDeck: ExtractedDeck): Promise<Buffer> {
	const deck = ExtractedDeckSchema.parse(rawDeck);
	const pptx = new PptxGenJS();
	pptx.layout = "LAYOUT_WIDE";
	pptx.title = deck.title;
	pptx.theme = { headFontFace: "Georgia", bodyFontFace: "Georgia" };

	for (const slide of deck.slides) {
		addExtractedSlideToPptx(pptx, slide);
	}

	const output = await pptx.write({ outputType: "nodebuffer" });
	const zip = await JSZip.loadAsync(output as ArrayBuffer);
	const slideFiles = Object.keys(zip.files).filter((filePath) =>
		/^ppt\/slides\/slide\d+\.xml$/.test(filePath),
	);
	for (const slideFile of slideFiles) {
		const rawXml = await zip.file(slideFile)!.async("string");
		zip.file(slideFile, sanitizeSlideOpenXml(rawXml));
	}
	const sanitizedOutput = await zip.generateAsync({ type: "nodebuffer" });
	return Buffer.from(sanitizedOutput);
}
