import type { CSSProperties, ReactNode } from "react";

export function ContextGrid({
	variant = "default",
	children,
}: {
	variant?: "default" | "shot";
	children: ReactNode;
}) {
	const className =
		variant === "shot" ? "context-grid is-shot" : "context-grid";
	return (
		<div className={className} data-pptx-layout="context-grid">
			{children}
		</div>
	);
}

const capabilityColsClass: Record<2 | 3 | 4 | 5, string> = {
	2: "capability-map is-two",
	3: "capability-map is-three",
	4: "capability-map is-four",
	5: "capability-map",
};

export function CapabilityMap({
	cols = 3,
	children,
}: {
	cols?: 2 | 3 | 4 | 5;
	children: ReactNode;
}) {
	return (
		<div
			className={capabilityColsClass[cols]}
			data-pptx-layout="capability-map"
			data-pptx-cols={cols}
		>
			{children}
		</div>
	);
}

export function CapabilityCard({
	model,
	summary,
	children,
}: {
	model: string;
	summary?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="capability-col" data-pptx-card="capability">
			<span className="model-name">{model}</span>
			{summary ? <p className="capability-summary">{summary}</p> : null}
			{children}
		</div>
	);
}

export function ConceptGrid({ children }: { children: ReactNode }) {
	return (
		<div className="concept-grid" data-pptx-layout="concept-grid">
			{children}
		</div>
	);
}

export function ConceptCard({
	label,
	title,
	summary,
	children,
}: {
	label: string;
	title?: ReactNode;
	summary?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="concept-card" data-pptx-card="concept">
			<span className="label">{label}</span>
			{title ? <h3>{title}</h3> : null}
			{summary ? <p className="concept-copy">{summary}</p> : null}
			{children}
		</div>
	);
}

export function SectionIndex({
	items,
	activeIndex,
	overview = false,
}: {
	items: string[];
	activeIndex?: number;
	overview?: boolean;
}) {
	const className = overview
		? "section-index is-overview"
		: "section-index";
	return (
		<ol className={className} data-pptx-layout="section-index">
			{items.map((item, idx) => (
				<li
					key={item}
					className={activeIndex === idx ? "is-active" : undefined}
					data-pptx-active={activeIndex === idx ? "true" : undefined}
				>
					{item}
				</li>
			))}
		</ol>
	);
}

export function CalloutStack({ children }: { children: ReactNode }) {
	return (
		<div className="callout-card-stack" data-pptx-layout="callout-stack">
			{children}
		</div>
	);
}

export function CalloutBox({
	tag,
	title,
	variant = "neutral",
	children,
}: {
	tag: string;
	title: string;
	variant?: "warning" | "success" | "neutral";
	children: ReactNode;
}) {
	const variantClass =
		variant === "warning"
			? "callout-box is-warning"
			: variant === "success"
				? "callout-box is-success"
				: "callout-box";
	return (
		<div
			className={variantClass}
			data-pptx-card="callout"
			data-pptx-variant={variant}
		>
			<span className="callout-tag">{tag}</span>
			<h4 className="callout-title">{title}</h4>
			<p className="callout-desc">{children}</p>
		</div>
	);
}

export function SlideQuote({
	attribution,
	children,
}: {
	attribution?: ReactNode;
	children: ReactNode;
}) {
	return (
		<blockquote className="slide-quote" data-pptx-role="quote">
			<p>{children}</p>
			{attribution ? <cite>{attribution}</cite> : null}
		</blockquote>
	);
}

export function ScoreReveal({
	value,
	unit,
	caption,
}: {
	value: string;
	unit?: string;
	caption?: ReactNode;
}) {
	return (
		<div className="score-reveal" data-pptx-role="score-reveal">
			<p className="score-number">
				{value}
				{unit ? <span>{unit}</span> : null}
			</p>
			{caption ? <p className="score-caption">{caption}</p> : null}
		</div>
	);
}

export function SlideVisual({
	label,
	children,
}: {
	label?: string;
	children: ReactNode;
}) {
	return (
		<div className="slide-visual" data-pptx="raster" aria-label={label}>
			{children}
		</div>
	);
}

export function CanvasSlide({
	background,
	children,
}: {
	background?: string;
	children: ReactNode;
}) {
	return (
		<div
			className="canvas-slide"
			data-pptx-layout="canvas"
			style={background ? { background } : undefined}
		>
			{children}
		</div>
	);
}

export function CanvasBox({
	x,
	y,
	w,
	h,
	style,
	children,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	style?: CSSProperties;
	children?: ReactNode;
}) {
	return (
		<div
			className="canvas-box"
			data-pptx-box="true"
			style={{
				position: "absolute",
				left: `${x}px`,
				top: `${y}px`,
				width: `${w}px`,
				height: `${h}px`,
				...style,
			}}
		>
			{children}
		</div>
	);
}
