import { defineConfig } from "vite";
import { slideDeckPlugin } from "slide-lib/vite";

export default defineConfig({
	plugins: [
		slideDeckPlugin({
			title: "Managed Agents Workshop",
			theme: "warm-paper",
			sections: [{ label: "Overview", from: 2 }],
		}),
	],
});
