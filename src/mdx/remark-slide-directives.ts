export interface MdxJsxAttribute {
	type: "mdxJsxAttribute";
	name: string;
	value: string | Record<string, unknown> | null;
}

export interface MdastNode {
	type: string;
	name?: string;
	depth?: number;
	value?: string;
	lang?: string | null;
	meta?: string | null;
	attributes?: Record<string, string | null | undefined> | MdxJsxAttribute[];
	data?: Record<string, unknown>;
	children?: MdastNode[];
}

function mdastToString(node: MdastNode | undefined): string {
	if (!node) return "";
	return typeof node.value === "string" ? node.value : (node.children?.map(mdastToString).join("") ?? "");
}

function jsxAttr(name: string, val: string | number | boolean | string[]): MdxJsxAttribute {
	if (typeof val === "string") return { type: "mdxJsxAttribute", name, value: val };
	const toLit = (v: string | number | boolean) => ({ type: "Literal", value: v, raw: JSON.stringify(v) });
	const expression = Array.isArray(val) ? { type: "ArrayExpression", elements: val.map(toLit) } : toLit(val);
	return {
		type: "mdxJsxAttribute",
		name,
		value: {
			type: "mdxJsxAttributeValueExpression",
			value: JSON.stringify(val),
			data: { estree: { type: "Program", sourceType: "module", body: [{ type: "ExpressionStatement", expression }] } },
		},
	};
}

function jsxFlow(name: string, attributes: MdxJsxAttribute[], children: MdastNode[] = []): MdastNode {
	return { type: "mdxJsxFlowElement", name, attributes, children };
}

function getDirectiveAttrs(node: MdastNode): Record<string, string | undefined> {
	if (!node.attributes || Array.isArray(node.attributes)) return {};
	return Object.fromEntries(Object.entries(node.attributes).filter((e): e is [string, string] => typeof e[1] === "string"));
}

function extractDirectiveLabel(children: MdastNode[]): { label?: string; rest: MdastNode[] } {
	return children[0]?.data?.directiveLabel === true
		? { label: mdastToString(children[0]).trim(), rest: children.slice(1) }
		: { rest: children };
}

function splitByHeading2(nodes: MdastNode[]): { label: string; children: MdastNode[] }[] {
	return nodes.reduce<{ label: string; children: MdastNode[] }[]>((cards, node) => {
		if (node.type === "heading" && node.depth === 2) cards.push({ label: mdastToString(node).trim(), children: [] });
		else if (cards.length > 0) cards[cards.length - 1].children.push(node);
		return cards;
	}, []);
}

function parseSlotMarker(node: MdastNode): { slot: "left" | "right" | "end"; variant?: string } | null {
	if (node.type === "leafDirective" && (node.name === "left" || node.name === "right" || node.name === "end")) {
		return { slot: node.name, variant: getDirectiveAttrs(node).variant };
	}
	if (node.type === "paragraph" && node.children?.length === 1 && node.children[0].type === "text") {
		const m = /^::(left|right|end)::$/.exec((node.children[0].value ?? "").trim());
		if (m) return { slot: m[1] as "left" | "right" | "end" };
	}
	return null;
}

const DIRECT_COL_COMPONENTS = new Set(["CalloutStack", "SlideVisual", "CodeCard", "SectionIndex", "div"]);

function wrapColumn(nodes: MdastNode[]): MdastNode {
	return nodes.length === 1 && nodes[0].type === "mdxJsxFlowElement" && DIRECT_COL_COMPONENTS.has(nodes[0].name ?? "")
		? nodes[0]
		: jsxFlow("div", [], nodes);
}

function applySlotSplit(nodes: MdastNode[], explicitVariant?: string): MdastNode[] {
	const rightIdx = nodes.findIndex((n) => parseSlotMarker(n)?.slot === "right");
	if (rightIdx === -1) return nodes;
	const leftIdx = nodes.findIndex((n, i) => i < rightIdx && parseSlotMarker(n)?.slot === "left");
	const splitStart =
		nodes.slice(0, rightIdx).findLastIndex((n) => n.type === "mdxjsEsm" || n.type === "yaml" || (n.type === "heading" && n.depth === 1)) + 1;
	const beforeSplit = leftIdx !== -1 ? nodes.slice(0, leftIdx) : nodes.slice(0, splitStart);
	const leftNodes = leftIdx !== -1 ? nodes.slice(leftIdx + 1, rightIdx) : nodes.slice(splitStart, rightIdx);

	let endIdx = nodes.findIndex((n, i) => i > rightIdx && parseSlotMarker(n)?.slot === "end");
	const hasEnd = endIdx !== -1;
	if (!hasEnd) {
		endIdx = nodes.length;
		while (
			endIdx > rightIdx + 1 &&
			nodes[endIdx - 1].type === "mdxJsxFlowElement" &&
			nodes[endIdx - 1].name === "p" &&
			Array.isArray(nodes[endIdx - 1].attributes) &&
			(nodes[endIdx - 1].attributes as MdxJsxAttribute[]).some((a) => a.name === "className" && a.value === "slide-footer-note")
		) {
			endIdx--;
		}
	}
	const variant =
		explicitVariant ?? (leftIdx !== -1 ? parseSlotMarker(nodes[leftIdx])?.variant : undefined) ?? parseSlotMarker(nodes[rightIdx])?.variant;
	return [
		...beforeSplit,
		jsxFlow("ContextGrid", variant === "shot" ? [jsxAttr("variant", "shot")] : [], [wrapColumn(leftNodes), wrapColumn(nodes.slice(rightIdx + 1, endIdx))]),
		...nodes.slice(hasEnd ? endIdx + 1 : endIdx),
	];
}

function stackConsecutiveCallouts(nodes: MdastNode[]): MdastNode[] {
	const out: MdastNode[] = [];
	let run: MdastNode[] = [];
	for (const node of nodes) {
		if (node.type === "mdxJsxFlowElement" && node.name === "CalloutBox" && node.data?.fromDirective === true) {
			run.push(node);
		} else {
			if (run.length > 0) out.push(jsxFlow("CalloutStack", [], run.splice(0)));
			out.push(node);
		}
	}
	if (run.length > 0) out.push(jsxFlow("CalloutStack", [], run));
	return out;
}

function transformNodes(nodes: MdastNode[]): MdastNode[] {
	const mapped = nodes.map((node): MdastNode => {
		if (node.type === "containerDirective") {
			const attrs = getDirectiveAttrs(node);
			const { label, rest } = extractDirectiveLabel(node.children ?? []);
			if (node.name === "grid" || node.name === "capabilities") {
				const cards = splitByHeading2(rest);
				const parsedCols = Number(attrs.cols);
				const cols = parsedCols >= 2 && parsedCols <= 5 ? parsedCols : Math.min(Math.max(cards.length, 2), 5);
				return jsxFlow("CapabilityMap", [jsxAttr("cols", cols)], cards.map((c) => jsxFlow("CapabilityCard", [jsxAttr("model", c.label)], transformNodes(c.children))));
			}
			if (node.name === "concepts") {
				return jsxFlow("ConceptGrid", [], splitByHeading2(rest).map((c) => jsxFlow("ConceptCard", [jsxAttr("label", c.label)], transformNodes(c.children))));
			}
			if (node.name === "callout" || node.name === "note" || node.name === "warning" || node.name === "success") {
				const variant = node.name === "warning" ? "warning" : node.name === "success" ? "success" : (attrs.variant ?? "neutral");
				const hasHeading = rest[0]?.type === "heading" && (rest[0].depth === 3 || rest[0].depth === 4);
				const title = hasHeading ? mdastToString(rest[0]).trim() : (attrs.title ?? "");
				const body = hasHeading ? rest.slice(1) : rest;
				const children = body.length === 1 && body[0].type === "paragraph" ? (body[0].children ?? []) : transformNodes(body);
				return { ...jsxFlow("CalloutBox", [jsxAttr("tag", label ?? attrs.tag ?? ""), jsxAttr("title", title), jsxAttr("variant", variant)], children), data: { fromDirective: true } };
			}
			if (node.name === "visual") {
				const vLabel = label ?? attrs.label;
				return jsxFlow("SlideVisual", vLabel ? [jsxAttr("label", vLabel)] : [], transformNodes(rest));
			}
			if (node.name === "quote") {
				const cite = label ?? attrs.attribution;
				const children = rest.length === 1 && rest[0].type === "paragraph" ? (rest[0].children ?? []) : transformNodes(rest);
				return jsxFlow("SlideQuote", cite ? [jsxAttr("attribution", cite)] : [], children);
			}
			if (node.name === "agenda") {
				const items = (rest.find((c) => c.type === "list")?.children ?? []).map((li) => mdastToString(li).trim());
				const agendaAttrs = [jsxAttr("items", items)];
				if (attrs.active !== undefined) agendaAttrs.push(jsxAttr("activeIndex", Number(attrs.active)));
				if (attrs.overview === "true" || attrs.overview === "") agendaAttrs.push(jsxAttr("overview", true));
				return jsxFlow("SectionIndex", agendaAttrs);
			}
			if (node.name === "split" || node.name === "cols") {
				const split = applySlotSplit(stackConsecutiveCallouts(transformNodes(rest)), attrs.variant);
				return split.length === 1 ? split[0] : jsxFlow("ContextGrid", [], split);
			}
		}
		if (node.type === "leafDirective") {
			const attrs = getDirectiveAttrs(node);
			if (node.name === "stat" || node.name === "score") {
				const statAttrs = [jsxAttr("value", mdastToString(node).trim() || (attrs.value ?? ""))];
				if (attrs.unit) statAttrs.push(jsxAttr("unit", attrs.unit));
				if (attrs.caption) statAttrs.push(jsxAttr("caption", attrs.caption));
				return jsxFlow("ScoreReveal", statAttrs);
			}
			if (node.name === "footer") return jsxFlow("p", [jsxAttr("className", "slide-footer-note")], node.children ?? []);
		}
		if (node.type === "code") {
			const meta = node.meta ?? "";
			const label = meta.match(/(?:title|label)=["']([^"']+)["']/)?.[1] ?? meta.match(/\[([^\]]+)\]/)?.[1];
			const codeAttrs = [jsxAttr("lang", node.lang || "python"), jsxAttr("code", node.value ?? "")];
			if (label) codeAttrs.push(jsxAttr("label", label));
			if (/\baccent\b/.test(meta)) codeAttrs.push(jsxAttr("accent", true));
			return jsxFlow("CodeCard", codeAttrs);
		}
		return node;
	});
	return stackConsecutiveCallouts(mapped);
}

export function remarkSlideDirectives() {
	return (tree: MdastNode) => {
		if (Array.isArray(tree.children)) tree.children = applySlotSplit(transformNodes(tree.children));
	};
}
