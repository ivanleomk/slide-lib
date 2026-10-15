// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { compileSync, runSync } from "@mdx-js/mdx";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import { render } from "@testing-library/react";
import * as jsxRuntime from "react/jsx-runtime";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { describe, expect, test } from "vitest";
import { CodeCard } from "../src/components/CodeCard.tsx";
import * as Primitives from "../src/components/primitives.tsx";
import { Em } from "../src/deck/Em.tsx";
import { Slide, remarkSlideDirectives } from "../src/index.ts";

const MDX_COMPONENTS = { ...Primitives, CodeCard, em: Em };
const requests = JSON.parse(fs.readFileSync(path.resolve("tests/assets/mdx_directives/request.json"), "utf8")) as { id: string; mdx: string }[];
const responses = fs
	.readFileSync(path.resolve("tests/assets/mdx_directives/response.jsonl"), "utf8")
	.trim()
	.split("\n")
	.map((line) => JSON.parse(line) as { id: string; code: string });

describe("Declarative Markdown directives compile to semantic slide-lib JSX primitives", () => {
	test.each(requests.map((r, i) => ({ id: r.id, mdx: r.mdx, expectedCode: responses[i].code })))(
		"lowers $id markdown directives to recorded MDX function body",
		({ mdx, expectedCode }) => {
			const compiled = compileSync(mdx, {
				outputFormat: "function-body",
				providerImportSource: "@mdx-js/react",
				remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkDirective, remarkSlideDirectives],
			});
			expect(String(compiled)).toEqual(expectedCode);
		},
	);

	test.each([
		{
			id: "capability-grid-5",
			expected: { layouts: ["capability-map"], cols: "2", models: ["× phone-a-friend", "× grader-tampering"], headings: ["Calling a smarter model", "Editing the grading script"], calloutVariants: [], codeLabel: null, conceptLabels: [], statNumber: null, footer: "Every one of these produced a score." },
		},
		{
			id: "split-callouts-code",
			expected: { layouts: ["context-grid", "callout-stack"], cols: null, models: [], headings: [], calloutVariants: ["warning", "success"], codeLabel: "interactions.py", conceptLabels: [], statNumber: null, footer: null },
		},
		{
			id: "concepts-and-stats",
			expected: { layouts: ["concept-grid", "callout-stack"], cols: null, models: [], headings: ["Evaluating humans"], calloutVariants: ["neutral"], codeLabel: null, conceptLabels: ["15 years", "Since Feb 2026"], statNumber: "31M+", footer: null },
		},
	])("renders $id into deterministic data-pptx-* DOM structure", ({ id, expected }) => {
		const record = responses.find((r) => r.id === id)!;
		const { default: MdxSlide } = runSync(record.code, { ...jsxRuntime, useMDXComponents });
		const { container } = render(
			<MDXProvider components={MDX_COMPONENTS}>
				<Slide slideNumber={1}>
					<MdxSlide />
				</Slide>
			</MDXProvider>,
		);

		expect({
			layouts: Array.from(container.querySelectorAll("[data-pptx-layout]")).map((el) => el.getAttribute("data-pptx-layout")),
			cols: container.querySelector(".capability-map")?.getAttribute("data-pptx-cols") ?? null,
			models: Array.from(container.querySelectorAll(".model-name")).map((el) => el.textContent),
			headings: Array.from(container.querySelectorAll("h3")).map((el) => el.textContent),
			calloutVariants: Array.from(container.querySelectorAll(".callout-box")).map((el) => el.getAttribute("data-pptx-variant")),
			codeLabel: container.querySelector(".code-card-label")?.textContent ?? null,
			conceptLabels: Array.from(container.querySelectorAll(".concept-card .label")).map((el) => el.textContent),
			statNumber: container.querySelector(".score-number")?.textContent ?? null,
			footer: container.querySelector(".slide-footer-note")?.textContent ?? null,
		}).toEqual(expected);
	});
});
