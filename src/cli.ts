#!/usr/bin/env node
import process from "node:process";
import { exportDeckToPptx } from "./export/export-pptx.ts";

function parseArgs(argv: string[]): Record<string, string> {
	const flags: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (next && !next.startsWith("--")) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = "true";
			}
		}
	}
	return flags;
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
	const [command, ...rest] = argv;
	const flags = parseArgs(rest);

	if (command === "export") {
		const url = flags.url ?? "http://localhost:5173";
		const outPath = flags.out ?? "deck.pptx";
		const title = flags.title ?? "Slide Deck";
		const concurrency = flags.concurrency
			? Number.parseInt(flags.concurrency, 10)
			: 6;
		await exportDeckToPptx({ url, outPath, title, concurrency });
		return;
	}

	throw new Error(
		`Unknown command "${command ?? ""}". Usage: slide-lib export --url <http://localhost:5173> --out <deck.pptx>`,
	);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runCli().catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}
