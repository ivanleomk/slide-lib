import type { ComponentType } from "react";
import {
	SectionRangeSchema,
	SlideFrontmatterSchema,
	type SectionRange,
	type SlideLayout,
} from "./schemas.ts";

export interface SlideModule {
	default: ComponentType;
	frontmatter?: unknown;
}

export interface ResolvedSlide {
	number: number;
	slug: string;
	Component: ComponentType;
	layout: SlideLayout;
	title?: string;
	eyebrow?: string;
	notes?: string;
}

export function resolveSectionEyebrow(
	slideNumber: number,
	sections: SectionRange[],
): string | undefined {
	const validated = sections.map((s) => SectionRangeSchema.parse(s));
	let activeIndex = -1;
	for (let i = 0; i < validated.length; i++) {
		if (slideNumber >= validated[i].from) {
			activeIndex = i;
		}
	}
	if (activeIndex === -1) return undefined;
	const prefix = String(activeIndex + 1).padStart(2, "0");
	return `${prefix} · ${validated[activeIndex].label}`;
}

export function resolveSlides(
	modules: Record<string, SlideModule>,
	sections: SectionRange[] = [],
): ResolvedSlide[] {
	return Object.entries(modules)
		.map(([path, mod]) => {
			const match = path.match(/\/(\d+(?:\.\d+)?)\.mdx$/);
			if (!match) {
				throw new Error(`Invalid slide filename "${path}". Expected <number>.mdx`);
			}
			const number = Number.parseFloat(match[1]);
			const fm = SlideFrontmatterSchema.parse(mod.frontmatter ?? {});
			const eyebrow =
				fm.eyebrow ??
				(fm.layout === "section"
					? undefined
					: resolveSectionEyebrow(number, sections));
			return {
				number,
				slug: match[1],
				Component: mod.default,
				layout: fm.layout,
				title: fm.title,
				eyebrow,
				notes: fm.notes,
			};
		})
		.sort((a, b) => a.number - b.number);
}
