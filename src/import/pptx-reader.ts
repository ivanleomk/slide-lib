import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { z } from "zod";
import { STAGE_HEIGHT_PX, STAGE_WIDTH_PX } from "../export/color.ts";
import { BoundingBoxSchema } from "../export/dom-walker.ts";

const DEFAULT_SLIDE_WIDTH_EMU = 12192000;
const DEFAULT_SLIDE_HEIGHT_EMU = 6858000;

export const PptxTextRunSchema = z.object({
	text: z.string(),
	fontSizePt: z.number().positive().default(18),
	fontFace: z.string().default("Newsreader"),
	colorHex: z.string().default("37352F"),
	bold: z.boolean().default(false),
	italic: z.boolean().default(false),
	isMonospace: z.boolean().default(false),
});

export type PptxTextRun = z.infer<typeof PptxTextRunSchema>;

export const PptxTextBoxSchema = z.object({
	bbox: BoundingBoxSchema,
	align: z.enum(["left", "center", "right"]).default("left"),
	runs: z.array(PptxTextRunSchema).min(1),
});

export type PptxTextBox = z.infer<typeof PptxTextBoxSchema>;

export const PptxPictureSchema = z.object({
	bbox: BoundingBoxSchema,
	mediaPath: z.string(),
	publicSrc: z.string(),
	data: z.instanceof(Buffer),
});

export type PptxPicture = z.infer<typeof PptxPictureSchema>;

export const PptxSlideRecordSchema = z.object({
	slideNumber: z.number().int().positive(),
	backgroundColorHex: z.string().default("FAF8F3"),
	textBoxes: z.array(PptxTextBoxSchema),
	pictures: z.array(PptxPictureSchema),
	notes: z.string().optional(),
});

export type PptxSlideRecord = z.infer<typeof PptxSlideRecordSchema>;

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	trimValues: false,
	isArray: (name) =>
		["p:sp", "p:pic", "a:p", "a:r", "Relationship", "p:sldId"].includes(name),
});

function toPx(emu: number, totalEmu: number, stagePx: number): number {
	return Math.round(((emu / totalEmu) * stagePx) * 10) / 10;
}

function parseXfrmBox(
	xfrm: Record<string, any> | undefined,
	widthEmu: number,
	heightEmu: number,
) {
	const off = xfrm?.["a:off"];
	const ext = xfrm?.["a:ext"];
	if (!off || !ext) return null;
	const x = Number.parseInt(String(off["@_x"] ?? "0"), 10);
	const y = Number.parseInt(String(off["@_y"] ?? "0"), 10);
	const cx = Number.parseInt(String(ext["@_cx"] ?? "0"), 10);
	const cy = Number.parseInt(String(ext["@_cy"] ?? "0"), 10);
	if (cx <= 0 || cy <= 0) return null;
	return {
		x: toPx(x, widthEmu, STAGE_WIDTH_PX),
		y: toPx(y, heightEmu, STAGE_HEIGHT_PX),
		w: toPx(cx, widthEmu, STAGE_WIDTH_PX),
		h: toPx(cy, heightEmu, STAGE_HEIGHT_PX),
	};
}

function extractNotesText(notesParsed: Record<string, any>): string | undefined {
	const shapes: Record<string, any>[] =
		notesParsed?.["p:notes"]?.["p:cSld"]?.["p:spTree"]?.["p:sp"] ?? [];
	const bodyShape = shapes.find(
		(sp) => sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.["@_type"] === "body",
	);
	if (!bodyShape) return undefined;
	const paragraphs: Record<string, any>[] =
		bodyShape?.["p:txBody"]?.["a:p"] ?? [];
	const text = paragraphs
		.map((p) =>
			(p?.["a:r"] ?? [])
				.map((r: any) => String(r?.["a:t"] ?? ""))
				.join(""),
		)
		.join("\n")
		.trim();
	return text || undefined;
}

export async function readPptxArchive(
	input: Buffer | Uint8Array,
): Promise<PptxSlideRecord[]> {
	const zip = await JSZip.loadAsync(input);

	let slideWidthEmu = DEFAULT_SLIDE_WIDTH_EMU;
	let slideHeightEmu = DEFAULT_SLIDE_HEIGHT_EMU;
	const presXml = await zip.file("ppt/presentation.xml")?.async("string");
	if (presXml) {
		const pres = xmlParser.parse(presXml);
		const sldSz = pres?.["p:presentation"]?.["p:sldSz"];
		if (sldSz?.["@_cx"] && sldSz?.["@_cy"]) {
			slideWidthEmu = Number.parseInt(String(sldSz["@_cx"]), 10);
			slideHeightEmu = Number.parseInt(String(sldSz["@_cy"]), 10);
		}
	}

	const slideFiles = Object.keys(zip.files)
		.map((filePath) => {
			const m = filePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
			return m ? { filePath, slideNumber: Number.parseInt(m[1], 10) } : null;
		})
		.filter((entry): entry is { filePath: string; slideNumber: number } =>
			Boolean(entry),
		)
		.sort((a, b) => a.slideNumber - b.slideNumber);

	const slides: PptxSlideRecord[] = [];

	for (const { filePath, slideNumber } of slideFiles) {
		const slideXml = await zip.file(filePath)!.async("string");
		const parsed = xmlParser.parse(slideXml);
		const cSld = parsed?.["p:sld"]?.["p:cSld"];
		const bgHex =
			cSld?.["p:bg"]?.["p:bgPr"]?.["a:solidFill"]?.["a:srgbClr"]?.["@_val"] ??
			"FAF8F3";

		const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
		const relsXml = await zip.file(relsPath)?.async("string");
		const relMap = new Map<string, string>();
		if (relsXml) {
			const relsParsed = xmlParser.parse(relsXml);
			const rels: Record<string, any>[] =
				relsParsed?.Relationships?.Relationship ?? [];
			for (const rel of rels) {
				if (rel["@_Id"] && rel["@_Target"]) {
					relMap.set(String(rel["@_Id"]), String(rel["@_Target"]));
				}
			}
		}

		const spTree = cSld?.["p:spTree"] ?? {};
		const rawShapes: Record<string, any>[] = spTree["p:sp"] ?? [];
		const rawPics: Record<string, any>[] = spTree["p:pic"] ?? [];

		const textBoxes: PptxTextBox[] = [];
		for (const sp of rawShapes) {
			const bbox = parseXfrmBox(
				sp?.["p:spPr"]?.["a:xfrm"],
				slideWidthEmu,
				slideHeightEmu,
			);
			if (!bbox) continue;

			const paragraphs: Record<string, any>[] =
				sp?.["p:txBody"]?.["a:p"] ?? [];
			const runs: PptxTextRun[] = [];
			let align: "left" | "center" | "right" = "left";

			for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
				const p = paragraphs[pIdx];
				const algnAttr = p?.["a:pPr"]?.["@_algn"];
				if (algnAttr === "ctr") align = "center";
				else if (algnAttr === "r") align = "right";

				const rawRuns: Record<string, any>[] = p?.["a:r"] ?? [];
				for (const r of rawRuns) {
					const rawText = r?.["a:t"];
					if (rawText === undefined || rawText === null) continue;
					const text = String(rawText);
					if (!text) continue;
					const rPr = r?.["a:rPr"] ?? {};
					const szHundredths = Number.parseInt(
						String(rPr["@_sz"] ?? "1800"),
						10,
					);
					const fontSizePt = Math.round((szHundredths / 100) * 10) / 10;
					const fontFace = String(
						rPr?.["a:latin"]?.["@_typeface"] ?? "Newsreader",
					);
					const colorHex = String(
						rPr?.["a:solidFill"]?.["a:srgbClr"]?.["@_val"] ?? "37352F",
					).toUpperCase();
					const bold = rPr["@_b"] === "1" || rPr["@_b"] === "true";
					const italic = rPr["@_i"] === "1" || rPr["@_i"] === "true";
					const isMonospace =
						fontFace.toLowerCase().includes("mono") ||
						fontFace.toLowerCase().includes("consolas");

					runs.push({
						text,
						fontSizePt,
						fontFace,
						colorHex,
						bold,
						italic,
						isMonospace,
					});
				}
			}

			if (runs.length > 0) {
				textBoxes.push({ bbox, align, runs });
			}
		}

		const pictures: PptxPicture[] = [];
		for (let picIdx = 0; picIdx < rawPics.length; picIdx++) {
			const pic = rawPics[picIdx];
			const bbox = parseXfrmBox(
				pic?.["p:spPr"]?.["a:xfrm"],
				slideWidthEmu,
				slideHeightEmu,
			);
			const embedId = pic?.["p:blipFill"]?.["a:blip"]?.["@_r:embed"];
			if (!bbox || !embedId) continue;
			const target = relMap.get(String(embedId));
			if (!target) continue;
			const normalizedZipPath = path.posix.normalize(
				path.posix.join("ppt/slides", target),
			);
			const zipFile = zip.file(normalizedZipPath);
			if (!zipFile) continue;
			const data = await zipFile.async("nodebuffer");
			const ext = path.posix.extname(normalizedZipPath) || ".png";
			const publicSrc = `/imported/slide-${slideNumber}-img-${picIdx + 1}${ext}`;
			pictures.push({
				bbox,
				mediaPath: normalizedZipPath,
				publicSrc,
				data,
			});
		}

		const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
		const notesXml = await zip.file(notesPath)?.async("string");
		const notes = notesXml
			? extractNotesText(xmlParser.parse(notesXml))
			: undefined;

		slides.push(
			PptxSlideRecordSchema.parse({
				slideNumber,
				backgroundColorHex: String(bgHex).toUpperCase(),
				textBoxes,
				pictures,
				notes,
			}),
		);
	}

	return slides;
}
