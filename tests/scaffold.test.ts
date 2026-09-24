import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.ts";
import { scaffoldSlideDeck } from "../src/index.ts";

describe("Agent Plugin manifest and CLI deck scaffolder", () => {
	test("plugin.json strictly conforms to the Jetski/Antigravity plugin manifest schema", () => {
		const raw = JSON.parse(
			fs.readFileSync(path.resolve("plugin.json"), "utf8"),
		) as Record<string, unknown>;
		const allowedKeys = new Set([
			"name",
			"description",
			"logo",
			"suggestedPrompts",
			"disabled",
		]);
		const unknownKeys = Object.keys(raw).filter((k) => !allowedKeys.has(k));

		expect({
			name: raw.name,
			hasDescription: typeof raw.description === "string" && raw.description.length > 10,
			unknownKeys,
			promptCount: Array.isArray(raw.suggestedPrompts)
				? raw.suggestedPrompts.length
				: 0,
		}).toEqual({
			name: "slide-lib",
			hasDescription: true,
			unknownKeys: [],
			promptCount: 3,
		});
	});

	test("skills/slide-lib/SKILL.md contains valid YAML frontmatter and pipeline instructions", () => {
		const skillMd = fs.readFileSync(
			path.resolve("skills/slide-lib/SKILL.md"),
			"utf8",
		);
		expect({
			startsWithFrontmatter: skillMd.startsWith("---\nname: slide-lib\n"),
			mentionsUseSlideFinalState: skillMd.includes("useSlideFinalState"),
			mentionsExportCommand: skillMd.includes("npx slide-lib export"),
			mentionsImportCommand: skillMd.includes("npx slide-lib import"),
		}).toEqual({
			startsWithFrontmatter: true,
			mentionsUseSlideFinalState: true,
			mentionsExportCommand: true,
			mentionsImportCommand: true,
		});
	});

	test.each([
		{
			title: "Kaggle Eval Deck",
			theme: "warm-paper" as const,
		},
		{
			title: "Managed Agents Workshop",
			theme: "studio-light" as const,
		},
	])(
		"scaffolds a minimal Vite + MDX deck for $title ($theme)",
		async ({ title, theme }) => {
			const tmpDir = fs.mkdtempSync(
				path.join(os.tmpdir(), "slide-lib-scaffold-"),
			);
			try {
				await runCli([
					"init",
					tmpDir,
					"--title",
					title,
					"--theme",
					theme,
				]);

				const relFiles = [
					"package.json",
					"vite.config.ts",
					"index.html",
					"src/main.tsx",
					"src/App.tsx",
					"content/1.mdx",
					"content/2.mdx",
				];

				const existsMap = Object.fromEntries(
					relFiles.map((f) => [f, fs.existsSync(path.join(tmpDir, f))]),
				);
				const viteConfig = fs.readFileSync(
					path.join(tmpDir, "vite.config.ts"),
					"utf8",
				);

				expect({
					existsMap,
					hasTitleInViteConfig: viteConfig.includes(JSON.stringify(title)),
					hasThemeInViteConfig: viteConfig.includes(JSON.stringify(theme)),
				}).toEqual({
					existsMap: {
						"package.json": true,
						"vite.config.ts": true,
						"index.html": true,
						"src/main.tsx": true,
						"src/App.tsx": true,
						"content/1.mdx": true,
						"content/2.mdx": true,
					},
					hasTitleInViteConfig: true,
					hasThemeInViteConfig: true,
				});
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		},
	);
});
