import { z } from "zod";

export const SlideLayoutSchema = z.enum([
	"default",
	"center",
	"section",
	"about",
	"exhibit",
	"canvas",
]);

export type SlideLayout = z.infer<typeof SlideLayoutSchema>;

export const SlideFrontmatterSchema = z.object({
	title: z.string().optional(),
	layout: SlideLayoutSchema.default("default"),
	eyebrow: z.string().optional(),
	notes: z.string().optional(),
});

export type SlideFrontmatter = z.infer<typeof SlideFrontmatterSchema>;

export const SectionRangeSchema = z.object({
	label: z.string().min(1),
	from: z.number().nonnegative(),
});

export type SectionRange = z.infer<typeof SectionRangeSchema>;

export const DeckThemeSchema = z.enum(["warm-paper", "studio-light"]);

export type DeckTheme = z.infer<typeof DeckThemeSchema>;

export const DeckConfigSchema = z.object({
	title: z.string().min(1).default("Slide Deck"),
	theme: DeckThemeSchema.default("warm-paper"),
	sections: z.array(SectionRangeSchema).default([]),
});

export type DeckConfig = z.infer<typeof DeckConfigSchema>;
