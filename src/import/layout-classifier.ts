import { z } from "zod";
import { BoundingBoxSchema } from "../export/dom-walker.ts";
import {
	PptxPictureSchema,
	PptxTextBoxSchema,
	type PptxSlideRecord,
	type PptxTextBox,
} from "./pptx-reader.ts";

export const ImportModeSchema = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("semantic"),
		theme: z.enum(["warm-paper", "studio-light"]).default("warm-paper"),
	}),
	z.object({
		mode: z.literal("exact"),
		preserveFonts: z.boolean().default(true),
	}),
]);

export type ImportMode = z.infer<typeof ImportModeSchema>;

export const SemanticBodyBlockSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("paragraph"),
		markdown: z.string(),
		bbox: BoundingBoxSchema,
	}),
	z.object({
		type: z.literal("code-card"),
		label: z.string().optional(),
		code: z.string(),
		bbox: BoundingBoxSchema,
	}),
	z.object({
		type: z.literal("image"),
		src: z.string(),
		bbox: BoundingBoxSchema,
	}),
	z.object({
		type: z.literal("capability-map"),
		cols: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
		cards: z.array(
			z.object({
				model: z.string(),
				summary: z.string(),
			}),
		),
	}),
]);

export type SemanticBodyBlock = z.infer<typeof SemanticBodyBlockSchema>;

export const ClassifiedSlideSchema = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("semantic"),
		slideNumber: z.number().int().positive(),
		layout: z.enum(["default", "center", "section"]),
		eyebrow: z.string().optional(),
		titleMarkdown: z.string().optional(),
		titlePlain: z.string().optional(),
		notes: z.string().optional(),
		gridVariant: z.enum(["none", "context-grid"]).default("none"),
		leftBlocks: z.array(SemanticBodyBlockSchema),
		rightBlocks: z.array(SemanticBodyBlockSchema),
	}),
	z.object({
		mode: z.literal("exact"),
		slideNumber: z.number().int().positive(),
		titlePlain: z.string().optional(),
		notes: z.string().optional(),
		backgroundColorHex: z.string(),
		textBoxes: z.array(PptxTextBoxSchema),
		pictures: z.array(PptxPictureSchema),
	}),
]);

export type ClassifiedSlide = z.infer<typeof ClassifiedSlideSchema>;

export function runsToMarkdown(box: PptxTextBox): string {
	return box.runs
		.map((r) => {
			if (!r.text.trim()) return r.text;
			if (r.italic) return `*${r.text.trim()}*`;
			if (r.bold) return `**${r.text.trim()}**`;
			return r.text;
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

export function runsToPlainText(box: PptxTextBox): string {
	return box.runs
		.map((r) => r.text)
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

export function classifyPptxSlide(
	slide: PptxSlideRecord,
	rawMode: ImportMode = { mode: "semantic", theme: "warm-paper" },
): ClassifiedSlide {
	const mode = ImportModeSchema.parse(rawMode);
	const sortedBoxes = [...slide.textBoxes].sort(
		(a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
	);

	const headingCandidate = sortedBoxes.find((b) =>
		b.runs.some((r) => r.fontSizePt >= 32),
	);
	const titlePlain = headingCandidate
		? runsToPlainText(headingCandidate)
		: undefined;

	if (mode.mode === "exact") {
		return ClassifiedSlideSchema.parse({
			mode: "exact",
			slideNumber: slide.slideNumber,
			titlePlain,
			notes: slide.notes,
			backgroundColorHex: slide.backgroundColorHex,
			textBoxes: sortedBoxes,
			pictures: slide.pictures,
		});
	}

	const eyebrowCandidate = sortedBoxes.find(
		(b) =>
			b !== headingCandidate &&
			b.bbox.y < (headingCandidate?.bbox.y ?? 500) &&
			b.runs.every((r) => r.fontSizePt <= 14 && r.isMonospace),
	);

	const remainingBoxes = sortedBoxes.filter(
		(b) => b !== headingCandidate && b !== eyebrowCandidate,
	);

	const monoLabels = remainingBoxes.filter(
		(b) =>
			b.runs.every((r) => r.isMonospace && r.fontSizePt <= 16) &&
			runsToPlainText(b).length <= 32,
	);

	if (monoLabels.length >= 2 && monoLabels.length <= 5 && slide.pictures.length === 0) {
		const baseY = monoLabels[0].bbox.y;
		const sameRow = monoLabels.every((b) => Math.abs(b.bbox.y - baseY) <= 40);
		if (sameRow) {
			const orderedCols = [...monoLabels].sort((a, b) => a.bbox.x - b.bbox.x);
			const bodyParas = remainingBoxes.filter((b) => !monoLabels.includes(b));
			const cards = orderedCols.map((colBox) => {
				const matchingPara = bodyParas.find(
					(p) =>
						Math.abs(p.bbox.x - colBox.bbox.x) <= 80 &&
						p.bbox.y > colBox.bbox.y,
				);
				return {
					model: runsToPlainText(colBox),
					summary: matchingPara ? runsToMarkdown(matchingPara) : "",
				};
			});
			const cols = orderedCols.length as 2 | 3 | 4 | 5;
			return ClassifiedSlideSchema.parse({
				mode: "semantic",
				slideNumber: slide.slideNumber,
				layout: "default",
				eyebrow: eyebrowCandidate ? runsToPlainText(eyebrowCandidate) : undefined,
				titleMarkdown: headingCandidate
					? runsToMarkdown(headingCandidate)
					: undefined,
				titlePlain,
				notes: slide.notes,
				gridVariant: "none",
				leftBlocks: [
					{
						type: "capability-map",
						cols,
						cards,
					},
				],
				rightBlocks: [],
			});
		}
	}

	const bodyBlocks: SemanticBodyBlock[] = [];
	const usedBoxes = new Set<PptxTextBox>();

	for (let i = 0; i < remainingBoxes.length; i++) {
		const box = remainingBoxes[i];
		if (usedBoxes.has(box)) continue;
		const isMonoBox = box.runs.every((r) => r.isMonospace);
		if (isMonoBox) {
			const nextBox = remainingBoxes[i + 1];
			if (
				nextBox &&
				nextBox.runs.every((r) => r.isMonospace) &&
				Math.abs(nextBox.bbox.x - box.bbox.x) <= 40 &&
				nextBox.bbox.y > box.bbox.y
			) {
				usedBoxes.add(box);
				usedBoxes.add(nextBox);
				bodyBlocks.push({
					type: "code-card",
					label: runsToPlainText(box),
					code: nextBox.runs.map((r) => r.text).join(""),
					bbox: nextBox.bbox,
				});
				continue;
			}
			usedBoxes.add(box);
			bodyBlocks.push({
				type: "code-card",
				code: box.runs.map((r) => r.text).join(""),
				bbox: box.bbox,
			});
			continue;
		}

		usedBoxes.add(box);
		bodyBlocks.push({
			type: "paragraph",
			markdown: runsToMarkdown(box),
			bbox: box.bbox,
		});
	}

	for (const pic of slide.pictures) {
		bodyBlocks.push({
			type: "image",
			src: pic.publicSrc,
			bbox: pic.bbox,
		});
	}

	const leftSide = bodyBlocks.filter((b) => "bbox" in b && b.bbox.x < 850);
	const rightSide = bodyBlocks.filter((b) => "bbox" in b && b.bbox.x >= 850);
	const isSplitGrid = leftSide.length > 0 && rightSide.length > 0;

	const isCenteredSlide =
		!isSplitGrid &&
		slide.pictures.length === 0 &&
		(headingCandidate?.align === "center" ||
			(headingCandidate?.bbox.x ?? 0) > 300);

	return ClassifiedSlideSchema.parse({
		mode: "semantic",
		slideNumber: slide.slideNumber,
		layout: isCenteredSlide ? "center" : "default",
		eyebrow: eyebrowCandidate ? runsToPlainText(eyebrowCandidate) : undefined,
		titleMarkdown: headingCandidate
			? runsToMarkdown(headingCandidate)
			: undefined,
		titlePlain,
		notes: slide.notes,
		gridVariant: isSplitGrid ? "context-grid" : "none",
		leftBlocks: isSplitGrid ? leftSide : bodyBlocks,
		rightBlocks: isSplitGrid ? rightSide : [],
	});
}
