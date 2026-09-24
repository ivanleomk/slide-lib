import { formatHex, parse } from "culori";

export const PPTX_WIDTH_INCHES = 13.333;
export const PPTX_HEIGHT_INCHES = 7.5;
export const STAGE_WIDTH_PX = 1920;
export const STAGE_HEIGHT_PX = 1080;

export interface NormalizedColor {
	hex: string;
	alpha: number;
}

export function normalizeCssColor(
	raw: string | undefined | null,
): NormalizedColor | null {
	if (!raw) return null;
	const trimmed = raw.trim().toLowerCase();
	if (
		!trimmed ||
		trimmed === "transparent" ||
		trimmed === "none" ||
		trimmed === "rgba(0, 0, 0, 0)"
	) {
		return null;
	}
	const parsed = parse(trimmed);
	if (!parsed) return null;
	const alpha = parsed.alpha ?? 1;
	if (alpha <= 0.01) return null;
	const hex = formatHex(parsed).replace(/^#/, "").toUpperCase();
	return {
		hex,
		alpha: Math.round(alpha * 100) / 100,
	};
}

export function normalizeFontFamily(cssFontFamily: string): string {
	const first = cssFontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
	if (!first) return "Newsreader";
	if (
		first.includes("Mono") ||
		first.includes("Consolas") ||
		first.includes("Menlo") ||
		first === "ui-monospace"
	) {
		return "JetBrains Mono";
	}
	if (
		first === "ui-sans-serif" ||
		first === "system-ui" ||
		first === "-apple-system"
	) {
		return "Inter";
	}
	return first;
}

export function pxToInchesX(px: number): number {
	return Math.round(((px / STAGE_WIDTH_PX) * PPTX_WIDTH_INCHES) * 1000) / 1000;
}

export function pxToInchesY(px: number): number {
	return (
		Math.round(((px / STAGE_HEIGHT_PX) * PPTX_HEIGHT_INCHES) * 1000) / 1000
	);
}

export function pxToPt(px: number): number {
	return Math.round(px * 0.75 * 10) / 10;
}
