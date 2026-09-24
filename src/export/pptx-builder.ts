import PptxGenJS from "pptxgenjs";
import {
	normalizeCssColor,
	normalizeFontFamily,
	pxToInchesX,
	pxToInchesY,
	pxToPt,
} from "./color.ts";
import {
	ExtractedDeckSchema,
	type ExtractedDeck,
	type ExtractedSlide,
} from "./dom-walker.ts";

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

	for (const element of rawSlide.elements) {
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

			const bufferedWidth = Math.round(w * 1.04 * 1000) / 1000;
			slide.addText(textRuns, {
				x,
				y,
				w: bufferedWidth,
				h: Math.max(h, 0.25),
				align: element.align,
				valign: "top",
				margin: 0,
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

	for (const slide of deck.slides) {
		addExtractedSlideToPptx(pptx, slide);
	}

	const output = await pptx.write({ outputType: "nodebuffer" });
	return Buffer.from(output as ArrayBuffer);
}
