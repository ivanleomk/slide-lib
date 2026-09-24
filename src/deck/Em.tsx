import type { ReactNode } from "react";

export function Em({ children }: { children?: ReactNode }) {
	return (
		<em className="em" data-pptx-em="true">
			{children}
		</em>
	);
}
