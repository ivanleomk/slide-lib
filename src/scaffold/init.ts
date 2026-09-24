import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DeckThemeSchema } from "../schemas.ts";

export const ScaffoldDeckConfigSchema = z.object({
	targetDir: z.string().min(1),
	title: z.string().min(1).default("Slide Deck"),
	theme: DeckThemeSchema.default("warm-paper"),
});

export type ScaffoldDeckConfig = z.infer<typeof ScaffoldDeckConfigSchema>;

export function scaffoldSlideDeck(rawConfig: ScaffoldDeckConfig): string[] {
	const config = ScaffoldDeckConfigSchema.parse(rawConfig);
	const root = path.resolve(config.targetDir);
	const srcDir = path.join(root, "src");
	const contentDir = path.join(root, "content");

	fs.mkdirSync(srcDir, { recursive: true });
	fs.mkdirSync(contentDir, { recursive: true });

	const files: Record<string, string> = {
		"package.json": JSON.stringify(
			{
				name: path.basename(root) || "slide-deck",
				private: true,
				version: "0.1.0",
				type: "module",
				scripts: {
					dev: "vite",
					build: "vite build",
					"export:pptx": "slide-lib export --url http://localhost:5173 --out deck.pptx",
				},
				dependencies: {
					"@mdx-js/react": "^3.1.1",
					react: "^19.2.4",
					"react-dom": "^19.2.4",
					"slide-lib": "^0.1.0",
				},
				devDependencies: {
					vite: "^8.0.1",
				},
			},
			null,
			2,
		) + "\n",
		"vite.config.ts": [
			'import { defineConfig } from "vite";',
			'import { slideDeckPlugin } from "slide-lib/vite";',
			"",
			"export default defineConfig({",
			"\tplugins: [",
			"\t\tslideDeckPlugin({",
			`\t\t\ttitle: ${JSON.stringify(config.title)},`,
			`\t\t\ttheme: ${JSON.stringify(config.theme)},`,
			'\t\t\tsections: [{ label: "Overview", from: 2 }],',
			"\t\t}),",
			"\t],",
			"});",
			"",
		].join("\n"),
		"index.html": [
			"<!doctype html>",
			'<html lang="en">',
			"  <head>",
			'    <meta charset="UTF-8" />',
			'    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
			`    <title>${config.title}</title>`,
			"  </head>",
			"  <body>",
			'    <div id="root"></div>',
			'    <script type="module" src="/src/main.tsx"></script>',
			"  </body>",
			"</html>",
			"",
		].join("\n"),
		"src/main.tsx": [
			'import { StrictMode } from "react";',
			'import { createRoot } from "react-dom/client";',
			'import "slide-lib/styles.css";',
			'import { App } from "./App.tsx";',
			"",
			'createRoot(document.getElementById("root")!).render(',
			"\t<StrictMode>",
			"\t\t<App />",
			"\t</StrictMode>,",
			");",
			"",
		].join("\n"),
		"src/App.tsx": [
			'import { MDXProvider } from "@mdx-js/react";',
			"import {",
			"\tCalloutBox,",
			"\tCalloutStack,",
			"\tCapabilityCard,",
			"\tCapabilityMap,",
			"\tClip,",
			"\tCodeCard,",
			"\tConceptCard,",
			"\tConceptGrid,",
			"\tContextGrid,",
			"\tDeck,",
			"\tEm,",
			"\t SectionIndex,",
			"\tSlide,",
			"\tSlideVisual,",
			"\tresolveSlides,",
			"\ttype SlideModule,",
			'} from "slide-lib";',
			"",
			'const modules = import.meta.glob<SlideModule>("../content/*.mdx", { eager: true });',
			'const slides = resolveSlides(modules, [{ label: "Overview", from: 2 }]);',
			"",
			"const mdxComponents = {",
			"\tem: Em,",
			"\tContextGrid,",
			"\tCapabilityMap,",
			"\tCapabilityCard,",
			"\tConceptGrid,",
			"\tConceptCard,",
			"\tSectionIndex,",
			"\tCalloutStack,",
			"\tCalloutBox,",
			"\tCodeCard,",
			"\tClip,",
			"\tSlideVisual,",
			"};",
			"",
			"export function App() {",
			"\treturn (",
			"\t\t<MDXProvider components={mdxComponents}>",
			`\t\t\t<Deck theme=${JSON.stringify(config.theme)} titles={slides.map((s) => s.title)}>`,
			"\t\t\t\t{slides.map(({ number, Component, layout, eyebrow, title }) => (",
			"\t\t\t\t\t<Slide key={number} slideNumber={number} layout={layout} eyebrow={eyebrow} title={title}>",
			"\t\t\t\t\t\t<Component />",
			"\t\t\t\t\t</Slide>",
			"\t\t\t\t))}",
			"\t\t\t</Deck>",
			"\t\t</MDXProvider>",
			"\t);",
			"}",
			"",
		].join("\n"),
		"content/1.mdx": [
			"---",
			`title: ${JSON.stringify(config.title)}`,
			'layout: "center"',
			'notes: "Welcome to the presentation."',
			"---",
			"",
			`# ${config.title} — built for *speed*`,
			"",
			"Author in MDX. Present in the browser. Export to editable PowerPoint and Google Slides.",
			"",
		].join("\n"),
		"content/2.mdx": [
			"---",
			'title: "Architecture & Code"',
			'layout: "default"',
			'notes: "Walk through the side-by-side context grid."',
			"---",
			"",
			"# Side-by-side *context* and code",
			"",
			"<ContextGrid>",
			"  <div>",
			"    Every slide renders on a deterministic 1920x1080 stage and exports directly to native OpenXML text and shapes.",
			"  </div>",
			'  <CodeCard label="example.ts" lang="typescript" code={`import { slideDeckPlugin } from "slide-lib/vite";\\nexport default { plugins: [slideDeckPlugin()] };`} />',
			"</ContextGrid>",
			"",
		].join("\n"),
	};

	const written: string[] = [];
	for (const [relPath, content] of Object.entries(files)) {
		const fullPath = path.join(root, relPath);
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, content, "utf8");
		written.push(fullPath);
	}
	return written;
}
