import { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

let highlighterPromise: Promise<Highlighter> | null = null;

export function getSlideHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: ["vitesse-dark", "vitesse-light"],
			langs: ["python", "typescript", "bash", "json", "yaml", "markdown"],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return highlighterPromise;
}

export interface CodeCardProps {
	label?: string;
	code?: string;
	lang?: string;
	theme?: "vitesse-dark" | "vitesse-light";
	accent?: boolean;
	empty?: string;
}

export function CodeCard({
	label,
	code,
	lang = "python",
	theme = "vitesse-dark",
	accent = false,
	empty,
}: CodeCardProps) {
	const [html, setHtml] = useState<string | null>(null);
	const trimmed = code?.trim() ?? "";

	useEffect(() => {
		if (!trimmed) return;
		let cancelled = false;
		getSlideHighlighter().then((highlighter) => {
			if (!cancelled) {
				setHtml(highlighter.codeToHtml(trimmed, { lang, theme }));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [trimmed, lang, theme]);

	const className = [
		"code-card",
		accent ? "is-accent" : "",
		!trimmed ? "is-empty" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<figure
			className={className}
			data-pptx-card="code"
			data-shiki-ready={!trimmed || html !== null ? "true" : "false"}
			aria-label={label}
		>
			{label ? <figcaption className="code-card-label">{label}</figcaption> : null}
			{trimmed ? (
				html ? (
					<div
						className="code-card-body"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				) : (
					<pre className="code-card-fallback">
						<code>{trimmed}</code>
					</pre>
				)
			) : (
				<div className="code-card-empty">{empty ?? "No code"}</div>
			)}
		</figure>
	);
}
