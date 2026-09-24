import {
	Children,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { DeckTheme } from "../schemas.ts";

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

const SlideExportContext = createContext<boolean>(false);

export function useSlideFinalState(): boolean {
	const isExport = useContext(SlideExportContext);
	if (isExport) return true;
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type ExportMode = "interactive" | "single" | "all";

function resolveExportMode(override?: ExportMode): ExportMode {
	if (override) return override;
	if (typeof window === "undefined") return "interactive";
	const params = new URLSearchParams(window.location.search);
	const mode = params.get("export");
	if (mode === "all") return "all";
	if (mode === "1" || mode === "true" || mode === "single") return "single";
	return "interactive";
}

function slideIndexFromLocation(total: number): number {
	if (typeof window === "undefined") return 0;
	const raw = window.location.pathname.replace(/^\/+|\/+$/g, "");
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || total <= 0) return 0;
	return Math.min(Math.max(n - 1, 0), total - 1);
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

const shortcuts: { keys: string[]; label: string }[] = [
	{ keys: ["Tab", "→", "↓", "PgDn", "Space"], label: "Next slide" },
	{ keys: ["Shift", "+", "Tab"], label: "Previous slide" },
	{ keys: ["←", "↑", "PgUp"], label: "Previous slide" },
	{ keys: ["Home"], label: "First slide" },
	{ keys: ["End"], label: "Last slide" },
	{ keys: ["F"], label: "Fullscreen" },
	{ keys: ["?"], label: "This list" },
];

export interface DeckProps {
	children: ReactNode;
	titles?: (string | undefined)[];
	theme?: DeckTheme;
	exportMode?: ExportMode;
	initialSlide?: number;
}

export function Deck({
	children,
	titles,
	theme = "warm-paper",
	exportMode: exportModeProp,
	initialSlide,
}: DeckProps) {
	const items = Children.toArray(children);
	const total = items.length;
	const exportMode = resolveExportMode(exportModeProp);
	const isExport = exportMode !== "interactive";

	const [index, setIndex] = useState(() =>
		initialSlide !== undefined
			? Math.min(Math.max(initialSlide, 0), Math.max(total - 1, 0))
			: slideIndexFromLocation(total),
	);
	const [dir, setDir] = useState<"next" | "prev">("next");
	const [helpOpen, setHelpOpen] = useState(false);
	const [scale, setScale] = useState(1);
	const [ready, setReady] = useState(false);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const sectionRef = useRef<HTMLElement>(null);

	useLayoutEffect(() => {
		if (isExport) {
			setScale(1);
			return;
		}
		const updateScale = () => {
			const nextScale = Math.min(
				window.innerWidth / STAGE_WIDTH,
				window.innerHeight / STAGE_HEIGHT,
			);
			setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
		};
		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [isExport]);

	useEffect(() => {
		let cancelled = false;
		const fontReady =
			typeof document !== "undefined" && "fonts" in document
				? document.fonts.ready
				: Promise.resolve();
		fontReady.then(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const go = useCallback(
		(target: number) => {
			if (total <= 0) return;
			const clamped = Math.min(Math.max(target, 0), total - 1);
			setIndex((current) => {
				if (clamped !== current) {
					setDir(clamped > current ? "next" : "prev");
				}
				return clamped;
			});
		},
		[total],
	);

	const step = useCallback(
		(delta: 1 | -1) => {
			const root = sectionRef.current;
			if (root && !isExport) {
				const fragments = Array.from(
					root.querySelectorAll<HTMLElement>("[data-fragment]"),
				);
				if (delta === 1) {
					const nextFrag = fragments.find(
						(el) => !el.classList.contains("is-visible"),
					);
					if (nextFrag) {
						nextFrag.classList.add("is-visible");
						return;
					}
				} else {
					const prevFrag = [...fragments]
						.reverse()
						.find((el) => el.classList.contains("is-visible"));
					if (prevFrag) {
						prevFrag.classList.remove("is-visible");
						return;
					}
				}
			}
			go(index + delta);
		},
		[go, index, isExport],
	);

	useEffect(() => {
		if (exportMode !== "interactive" || initialSlide !== undefined) return;
		const targetPath = `/${index + 1}${window.location.search}`;
		if (window.location.pathname !== `/${index + 1}`) {
			window.history.pushState(null, "", targetPath);
		}
	}, [index, exportMode, initialSlide]);

	useEffect(() => {
		if (exportMode !== "interactive") return;
		const onPopState = () => {
			setIndex(slideIndexFromLocation(total));
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [total, exportMode]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || typeof dialog.showModal !== "function") return;
		if (helpOpen && !dialog.open) {
			dialog.showModal();
		} else if (!helpOpen && dialog.open) {
			dialog.close();
		}
	}, [helpOpen]);

	useEffect(() => {
		if (exportMode !== "interactive") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isEditable(event.target)) return;

			if (event.key === "?") {
				event.preventDefault();
				setHelpOpen((open) => !open);
				return;
			}

			if (helpOpen) return;

			switch (event.key) {
				case "Tab":
					event.preventDefault();
					step(event.shiftKey ? -1 : 1);
					return;
				case "ArrowRight":
				case "ArrowDown":
				case "PageDown":
					event.preventDefault();
					step(1);
					return;
				case " ":
					event.preventDefault();
					step(event.shiftKey ? -1 : 1);
					return;
				case "ArrowLeft":
				case "ArrowUp":
				case "PageUp":
					event.preventDefault();
					step(-1);
					return;
				case "Home":
					event.preventDefault();
					go(0);
					return;
				case "End":
					event.preventDefault();
					go(total - 1);
					return;
				case "f":
				case "F":
					event.preventDefault();
					if (document.fullscreenElement) {
						void document.exitFullscreen();
					} else {
						void document.documentElement.requestFullscreen();
					}
					return;
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [go, step, helpOpen, total, exportMode]);

	if (exportMode === "all") {
		return (
			<SlideExportContext.Provider value={true}>
				<main
					className="deck-export-all"
					data-theme={theme}
					data-export="true"
					data-deck-ready={ready ? "true" : "false"}
				>
					{items.map((slideNode, idx) => (
						<section
							key={idx}
							className="deck-slide is-export-frame"
							data-slide-index={idx}
							aria-label={`Slide ${idx + 1} of ${total}`}
						>
							{slideNode}
						</section>
					))}
				</main>
			</SlideExportContext.Provider>
		);
	}

	const title = titles?.[index];
	const label = `Slide ${index + 1} of ${total}${title ? `: ${title}` : ""}`;

	return (
		<SlideExportContext.Provider value={isExport}>
			<main
				className="deck"
				data-theme={theme}
				data-export={isExport ? "true" : "false"}
				data-deck-ready={ready ? "true" : "false"}
				aria-roledescription="slide deck"
			>
				<div className="sr-only" aria-live="polite" aria-atomic="true">
					{label}
				</div>

				<div
					className="deck-viewport"
					style={{ "--stage-scale": String(scale) } as React.CSSProperties}
				>
					<section
						key={index}
						ref={sectionRef}
						className="deck-slide"
						data-dir={dir}
						data-slide-index={index}
						aria-roledescription="slide"
						aria-label={label}
					>
						{items[index]}
					</section>
				</div>

				<dialog
					ref={dialogRef}
					className="help"
					aria-labelledby="help-title"
					onClose={() => setHelpOpen(false)}
					onClick={(event) => {
						if (event.target === event.currentTarget) setHelpOpen(false);
					}}
				>
					<div className="help-sheet">
						<header className="help-head">
							<h2 id="help-title">Keyboard shortcuts</h2>
							<button
								type="button"
								className="help-close"
								onClick={() => setHelpOpen(false)}
								aria-label="Close keyboard shortcuts"
							>
								Esc
							</button>
						</header>

						<dl className="help-list">
							{shortcuts.map(({ keys, label: itemLabel }) => (
								<div key={itemLabel + keys.join("")} className="help-row">
									<dt className="help-keys">
										{keys.map((key) =>
											key === "+" ? (
												<span key={key} className="help-plus" aria-hidden="true">
													+
												</span>
											) : (
												<kbd key={key}>{key}</kbd>
											),
										)}
									</dt>
									<dd className="help-desc">{itemLabel}</dd>
								</div>
							))}
						</dl>
					</div>
				</dialog>
			</main>
		</SlideExportContext.Provider>
	);
}
