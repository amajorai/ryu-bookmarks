import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const e2eDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(e2eDirectory, "..");
const baseURL = "http://127.0.0.1:4593";

export default defineConfig({
	testDir: e2eDirectory,
	testMatch: "bookmarks-companion.spec.ts",
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	outputDir: "/tmp/ryu-bookmarks-playwright-results",
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		contextOptions: { reducedMotion: "reduce" },
		viewport: { width: 1440, height: 960 },
	},
	webServer: {
		command:
			"bun run build && bun run vite preview --host 127.0.0.1 --port 4593 --strictPort",
		cwd: appRoot,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
