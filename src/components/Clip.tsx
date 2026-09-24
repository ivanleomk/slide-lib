import { useEffect, useRef } from "react";

export function Clip({
	src,
	label,
	muted = true,
	aspectRatio,
}: {
	src: string;
	label?: string;
	muted?: boolean;
	aspectRatio?: string;
}) {
	const ref = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = ref.current;
		if (!video) return;
		video.currentTime = 0;
		video.muted = muted;
		video.play().catch(() => {
			video.muted = true;
			video.play().catch(() => {});
		});
	}, [src, muted]);

	return (
		<figure
			className="clip"
			data-pptx-media="video"
			data-pptx-src={src}
			style={aspectRatio ? { aspectRatio } : undefined}
		>
			<video ref={ref} src={src} loop muted={muted} playsInline preload="auto" />
			{label ? <figcaption>{label}</figcaption> : null}
		</figure>
	);
}
