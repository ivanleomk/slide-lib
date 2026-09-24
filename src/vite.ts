import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { PluginOption } from "vite";
import { DeckConfigSchema, type DeckConfig } from "./schemas.ts";

export function slideDeckPlugin(rawConfig: Partial<DeckConfig> = {}): PluginOption[] {
	const config = DeckConfigSchema.parse(rawConfig);
	const virtualModuleId = "virtual:slide-lib/config";
	const resolvedVirtualModuleId = `\0${virtualModuleId}`;

	const configPlugin: PluginOption = {
		name: "slide-lib:config",
		resolveId(id) {
			if (id === virtualModuleId) return resolvedVirtualModuleId;
			return null;
		},
		load(id) {
			if (id === resolvedVirtualModuleId) {
				return `export const deckConfig = ${JSON.stringify(config)};`;
			}
			return null;
		},
	};

	return [
		configPlugin,
		{
			enforce: "pre",
			...mdx({
				include: /\.mdx$/,
				providerImportSource: "@mdx-js/react",
				remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
				rehypePlugins: [
					[
						rehypeShiki,
						{
							theme: "vitesse-light",
							colorReplacements: {
								"#ffffff": "var(--surface)",
							},
						},
					],
				],
			}),
		},
		tailwindcss(),
		react({ include: /\.(jsx|js|mdx|ts|tsx)$/ }),
	];
}
