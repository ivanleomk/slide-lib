import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
	ClassifiedSlideSchema,
	ImportModeSchema,
	classifyPptxSlide,
	runsToMarkdown,
	type ClassifiedSlide,
	type ImportMode,
	type SemanticBodyBlock,
} from "./layout-classifier.ts";
import { readPptxArchive, type PptxSlideRecord } from "./pptx-reader.ts";

function renderSemanticBlock(block: SemanticBodyBlock, indent = ""): string {
	if (block.type === "paragraph") {
		return `${indent}${block.markdown}`;
	}
	if (block.type === "image") {
		return `${indent}<img src="${block.src}" alt="" />`;
	}
	if (block.type === "code-card") {
		const labelProp = block.label ? ` label=${JSON.stringify(block.label)}` : "";
		return `${indent}<CodeCard${labelProp} code={${JSON.stringify(block.code)}} />`;
	}
	if (block.type === "capability-map") {
		const cardsMdx = block.cards
			.map(
				(c) =>
					`${indent}  <CapabilityCard model=${JSON.stringify(c.model)} summary=${JSON.stringify(c.summary)} />`,
			)
			.join("\n");
		return `${indent}<CapabilityMap cols={${block.cols}}>\n${cardsMdx}\n${indent}</CapabilityMap>`;
	}
	return "";
}

export function emitSlideMdx(rawSlide: ClassifiedSlide): string {
	const slide = ClassifiedSlideSchema.parse(rawSlide);
	const fmLines: string[] = ["---"];
	if (slide.titlePlain) {
		fmLines.push(`title: ${JSON.stringify(slide.titlePlain)}`);
	}
	if (slide.mode === "exact") {
		fmLines.push(`layout: "canvas"`);
	} else {
		fmLines.push(`layout: ${JSON.stringify(slide.layout)}`);
		if (slide.eyebrow) {
			fmLines.push(`eyebrow: ${JSON.stringify(slide.eyebrow)}`);
		}
	}
	if (slide.notes) {
		fmLines.push(`notes: ${JSON.stringify(slide.notes)}`);
	}
	fmLines.push("---", "");

	if (slide.mode === "exact") {
		const boxLines = slide.textBoxes.map((b) => {
			const md = runsToMarkdown(b);
			return `  <CanvasBox x={${b.bbox.x}} y={${b.bbox.y}} w={${b.bbox.w}} h={${b.bbox.h}}>\n    ${md}\n  </CanvasBox>`;
		});
		const picLines = slide.pictures.map(
			(p) =>
				`  <CanvasBox x={${p.bbox.x}} y={${p.bbox.y}} w={${p.bbox.w}} h={${p.bbox.h}}>\n    <img src="${p.publicSrc}" alt="" />\n  </CanvasBox>`,
		);
		const body = [...boxLines, ...picLines].join("\n");
		return `${fmLines.join("\n")}\n<CanvasSlide background="#${slide.backgroundColorHex}">\n${body}\n</CanvasSlide>\n`;
	}

	const lines: string[] = [...fmLines];
	if (slide.titleMarkdown) {
		lines.push(`# ${slide.titleMarkdown}`, "");
	}

	if (slide.gridVariant === "context-grid") {
		const leftContent = slide.leftBlocks
			.map((b) => renderSemanticBlock(b, "    "))
			.join("\n\n");
		const rightContent = slide.rightBlocks
			.map((b) => renderSemanticBlock(b, "    "))
			.join("\n\n");
		lines.push(
			"<ContextGrid>",
			"  <div>",
			leftContent,
			"  </div>",
			"  <div>",
			rightContent,
			"  </div>",
			"</ContextGrid>",
			"",
		);
	} else {
		for (const block of slide.leftBlocks) {
			lines.push(renderSemanticBlock(block), "");
		}
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

export const ImportPptxConfigSchema = z.object({
	pptxPath: z.string().min(1),
	outDir: z.string().min(1),
	mode: ImportModeSchema.default({ mode: "semantic", theme: "warm-paper" }),
});

export type ImportPptxConfig = z.infer<typeof ImportPptxConfigSchema>;

export async function importPptxToMdx(
	rawConfig: ImportPptxConfig,
): Promise<{ slides: ClassifiedSlide[]; writtenFiles: string[] }> {
	const config = ImportPptxConfigSchema.parse(rawConfig);
	const buf = fs.readFileSync(config.pptxPath);
	const rawSlides: PptxSlideRecord[] = await readPptxArchive(buf);

	const contentDir = path.join(config.outDir, "content");
	const publicDir = path.join(config.outDir, "public");
	fs.mkdirSync(contentDir, { recursive: true });

	const classifiedSlides: ClassifiedSlide[] = [];
	const writtenFiles: string[] = [];

	for (const raw of rawSlides) {
		for (const pic of raw.pictures) {
			const targetAssetPath = path.join(
				publicDir,
				pic.publicSrc.replace(/^\/+/, ""),
			);
			fs.mkdirSync(path.dirname(targetAssetPath), { recursive: true });
			fs.writeFileSync(targetAssetPath, pic.data);
			writtenFiles.push(targetAssetPath);
		}

		const classified = classifyPptxSlide(raw, config.mode as ImportMode);
		classifiedSlides.push(classified);
		const mdxSource = emitSlideMdx(classified);
		const mdxPath = path.join(contentDir, `${raw.slideNumber}.mdx`);
		fs.writeFileSync(mdxPath, mdxSource, "utf8");
		writtenFiles.push(mdxPath);
	}

	return { slides: classifiedSlides, writtenFiles };
}
