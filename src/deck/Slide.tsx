import type { ReactNode } from "react";
import type { SlideLayout } from "../schemas.ts";

export interface SlideProps {
	layout?: SlideLayout;
	eyebrow?: string;
	slideNumber?: number;
	title?: string;
	children: ReactNode;
}

export function Slide({
	layout = "default",
	eyebrow,
	slideNumber,
	title,
	children,
}: SlideProps) {
	const layoutClass = layout === "default" ? "slide" : `slide ${layout}`;
	return (
		<article
			className={layoutClass}
			data-slide-stage="true"
			data-slide-layout={layout}
			data-slide-number={slideNumber}
			data-slide-title={title}
		>
			{eyebrow && layout !== "section" ? (
				<p className="slide-eyebrow" data-pptx-role="eyebrow">
					{eyebrow}
				</p>
			) : null}
			{children}
		</article>
	);
}
