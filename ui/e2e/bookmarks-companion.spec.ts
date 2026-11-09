import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { bookmarkSchema } from "../src/schemas.ts";
import type { BookmarksHostOptions } from "./bookmarks-fixture.ts";

// Bundle the typed installer and its parsers into one init script: serialized
// Playwright callbacks cannot reference imported schema closures.
const fixtureDirectory = mkdtempSync(
	path.join(tmpdir(), "ryu-bookmarks-fixture-")
);
const fixtureBundlePath = path.join(fixtureDirectory, "fixture.js");
execFileSync("bun", [
	"build",
	path.resolve(import.meta.dirname, "bookmarks-fixture-entry.ts"),
	"--target=browser",
	"--format=iife",
	`--outfile=${fixtureBundlePath}`,
]);
const fixtureBootstrap = readFileSync(fixtureBundlePath, "utf8");

// Run the built companion in Chromium with a local, in-memory host bridge.

interface BookmarkRecord {
	createdAt: number;
	description: string;
	favorite: boolean;
	folder: string;
	id: string;
	tags: string[];
	title: string;
	updatedAt: number;
	url: string;
}

interface FixtureOptions {
	bookmarks?: BookmarkRecord[];
	failEnsureSpace?: number;
	searchIds?: string[] | null;
}

const STORAGE_KEY = "ryu-bookmarks-companion-e2e-v1";
const EVIDENCE_DIRECTORY = path.resolve(import.meta.dirname, "evidence");
const FIXTURE_DIRECTORY = path.resolve(import.meta.dirname, "fixtures");

function bookmark(
	id: string,
	title: string,
	overrides: Partial<BookmarkRecord> = {}
): BookmarkRecord {
	return {
		createdAt: 1_790_600_000_000,
		description: `${title} fixture note`,
		favorite: false,
		folder: "Research",
		id,
		tags: ["research", "browser"],
		title,
		updatedAt: 1_790_600_000_000,
		url: `https://${id}.example.test/`,
		...overrides,
	};
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
	const fixtureOptions: BookmarksHostOptions = {
		failEnsureSpace: options.failEnsureSpace ?? 0,
		initialBookmarks: options.bookmarks ?? [],
		searchIds: options.searchIds ?? null,
		storageKey: STORAGE_KEY,
	};
	await page.addInitScript({
		content: `${fixtureBootstrap}
window.__installBookmarksHost(${JSON.stringify(fixtureOptions)});`,
	});
}

async function openApp(page: Page, options: FixtureOptions = {}) {
	await installFixture(page, options);
	await page.goto("/");
	const app = page.locator("#ryu-plugin-root");
	await expect(
		app.getByRole("heading", { name: "All bookmarks" })
	).toBeVisible();
	await expect(
		app.getByText("Loading your library…", { exact: false })
	).toHaveCount(0);
	return app;
}

async function fixtureSnapshot(page: Page) {
	return page.evaluate(() => {
		const fixture = window.__bookmarksFixture;
		if (!fixture) {
			throw new Error("The local Bookmarks fixture was not installed.");
		}
		return structuredClone(fixture);
	});
}

async function saveProductScreenshot(page: Page, name: string) {
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await page.screenshot({
		animations: "disabled",
		fullPage: true,
		path: path.join(EVIDENCE_DIRECTORY, name),
	});
}

async function waitForStableLayout(locator: Locator) {
	let previous: { height: number; width: number; x: number; y: number } | null =
		null;
	let stableSamples = 0;
	await expect
		.poll(async () => {
			const current = await locator.boundingBox();
			if (!current) {
				previous = null;
				stableSamples = 0;
				return stableSamples;
			}
			const unchanged =
				previous !== null &&
				Math.abs(current.x - previous.x) < 0.5 &&
				Math.abs(current.y - previous.y) < 0.5 &&
				Math.abs(current.width - previous.width) < 0.5 &&
				Math.abs(current.height - previous.height) < 0.5;
			stableSamples = unchanged ? stableSamples + 1 : 0;
			previous = current;
			return stableSamples;
		})
		.toBeGreaterThanOrEqual(3);
}

async function expectTooltipOnHoverAndFocus(
	page: Page,
	trigger: Locator,
	content: string
): Promise<void> {
	await trigger.hover();
	const tooltip = page.getByRole("tooltip", { exact: true, name: content });
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(content);
	const hoverId = await tooltip.getAttribute("id");
	const hoverDescriptionIds = (
		await trigger.getAttribute("aria-describedby")
	)?.split(/\s+/u);
	expect(hoverId).toBeTruthy();
	expect(hoverDescriptionIds).toContain(hoverId);

	await page.mouse.move(1, 1);
	await expect(tooltip).toHaveCount(0);
	await trigger.focus();
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(content);
	const focusId = await tooltip.getAttribute("id");
	const focusDescriptionIds = (
		await trigger.getAttribute("aria-describedby")
	)?.split(/\s+/u);
	expect(focusId).toBeTruthy();
	expect(focusDescriptionIds).toContain(focusId);
	await trigger.evaluate((element) => element.blur());
	await expect(tooltip).toHaveCount(0);
}

test("submits the add form from the URL field and reads back the saved bookmark", async ({
	page,
}) => {
	const app = await openApp(page);
	await app.getByRole("button", { name: "Add bookmark", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("URL").fill("https://www.example.test/research");
	await dialog.getByLabel("Name").fill("Research notes");
	await dialog.getByLabel("Note optional").fill("Keep the useful details.");
	await dialog.getByLabel("Folder optional").fill("Reading / Later");
	await dialog.getByLabel("Name").press("Enter");
	await expect(dialog).toBeHidden();
	await app
		.getByRole("button", { name: "Reading / Later", exact: true })
		.click();
	const savedFolder = page.getByRole("dialog");
	await expect(
		savedFolder.getByRole("button", { name: "Research notes", exact: true })
	).toBeVisible();
	await waitForStableLayout(savedFolder.getByRole("article"));
	const saved = await fixtureSnapshot(page);
	const document = saved.state.bookmarks[0];
	const source = bookmarkSchema.parse(JSON.parse(document?.source ?? "{}"));
	// The form keyboard submission persists the complete bookmark through Space.
	expect(source).toMatchObject({
		description: "Keep the useful details.",
		favorite: false,
		folder: "Reading / Later",
		title: "Research notes",
		url: "https://www.example.test/research",
	});
	expect(saved.calls.filter((call) => call.method === "createDoc")).toEqual([
		{
			input: { space_id: "bookmarks-space-fixture", title: "Research notes" },
			method: "createDoc",
		},
	]);
	await saveProductScreenshot(page, "bookmarks-saved-library.png");
	await page.reload();
	await expect(
		page.getByRole("button", { name: "Reading / Later", exact: true })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Reading / Later", exact: true })
		.click();
	await expect(
		page
			.getByRole("dialog")
			.getByRole("button", { name: "Research notes", exact: true })
	).toBeVisible();
	const persisted = await fixtureSnapshot(page);
	// Reload reads the written record back from the same local Space fixture.
	expect(
		JSON.parse(persisted.state.bookmarks[0]?.source ?? "{}")
	).toMatchObject({
		title: "Research notes",
		folder: "Reading / Later",
	});
});

test("imports from both visible entry points and stores nested folders in Space", async ({
	page,
}) => {
	const app = await openApp(page);
	await expect(
		app.getByText("No bookmarks yet", { exact: true })
	).toBeVisible();
	const importButtons = app.getByRole("button", { name: "Import HTML" });
	await expect(importButtons).toHaveCount(2);
	const firstChooserPromise = page.waitForEvent("filechooser");
	await importButtons.last().click();
	const firstChooser = await firstChooserPromise;
	await firstChooser.setFiles(
		path.join(FIXTURE_DIRECTORY, "bookmarks-first-export.html")
	);
	await app.getByRole("button", { name: "Reading", exact: true }).click();
	const firstFolder = page.getByRole("dialog");
	await expect(
		firstFolder.getByRole("button", { name: "Migration guide", exact: true })
	).toBeVisible();
	await expect(
		firstFolder.getByRole("button", { name: "Service health", exact: true })
	).toBeVisible();
	const firstImport = await fixtureSnapshot(page);
	const importedTitles = firstImport.state.bookmarks.map((document) => {
		const item = bookmarkSchema.parse(JSON.parse(document.source));
		return { folder: item.folder, title: item.title, url: item.url };
	});
	// The empty-state import action selects a file and persists every parsed link.
	expect(importedTitles).toEqual([
		{
			folder: "Reading",
			title: "Migration guide",
			url: "https://docs.example.test/migration",
		},
		{
			folder: "Reading",
			title: "Service health",
			url: "https://status.example.test/health",
		},
	]);
	expect(
		firstImport.calls.filter((call) => call.method === "createDoc")
	).toHaveLength(2);
	await page.getByRole("button", { name: "Close folder" }).click();

	const headerImport = app.getByRole("button", {
		name: "Import HTML",
		exact: true,
	});
	await expect(headerImport).toBeVisible();
	const secondChooserPromise = page.waitForEvent("filechooser");
	await headerImport.click();
	const secondChooser = await secondChooserPromise;
	await secondChooser.setFiles(
		path.join(FIXTURE_DIRECTORY, "bookmarks-second-export.html")
	);
	await expect(app.getByLabel("design")).toBeVisible();
	const completeImport = await fixtureSnapshot(page);
	// The toolbar entry point shares the hidden file input and stores its selection.
	expect(completeImport.state.bookmarks.map((item) => item.title)).toEqual([
		"Migration guide",
		"Service health",
		"Design tokens",
	]);
	await saveProductScreenshot(page, "bookmarks-library-after-html-import.png");
});

test("retries the initial Space read after a temporary local failure", async ({
	page,
}) => {
	const app = await openApp(page, { failEnsureSpace: 1 });
	await expect(app.getByRole("alert")).toContainText(
		"The local Space fixture is temporarily unavailable"
	);
	await app.getByRole("button", { name: "Try again" }).click();
	await expect(
		app.getByText("No bookmarks yet", { exact: true })
	).toBeVisible();
	const snapshot = await fixtureSnapshot(page);
	// Retry makes a second Space request and clears the initial bootstrap error.
	expect(
		snapshot.calls.filter((call) => call.method === "ensureSpace")
	).toHaveLength(2);
	expect(snapshot.calls.at(-1)).toEqual({
		input: { space_id: "bookmarks-space-fixture" },
		method: "listDocs",
	});
});

test("resets an empty semantic-search view to the full saved library", async ({
	page,
}) => {
	const app = await openApp(page, {
		bookmarks: [
			bookmark("item-one", "Migration notes"),
			bookmark("item-two", "Service dashboard"),
		],
		searchIds: [],
	});
	await app
		.getByRole("textbox", { name: "Search bookmarks semantically" })
		.fill("nothing matches");
	await app.getByRole("button", { name: "Semantic search" }).click();
	await expect(app.getByText("Nothing in this view yet.")).toBeVisible();
	await app.getByRole("button", { name: "Reset view" }).click();
	await expect(
		app.getByRole("heading", { name: "All bookmarks" })
	).toBeVisible();
	await app.getByRole("button", { name: "Research", exact: true }).click();
	const researchFolder = page.getByRole("dialog");
	await expect(
		researchFolder.getByRole("button", { name: "Migration notes", exact: true })
	).toBeVisible();
	await expect(
		researchFolder.getByRole("button", {
			name: "Service dashboard",
			exact: true,
		})
	).toBeVisible();
	const snapshot = await fixtureSnapshot(page);
	// Reset clears the query and restores every locally saved bookmark.
	expect(snapshot.state.bookmarks).toHaveLength(2);
	expect(snapshot.calls).toContainEqual({
		input: {
			limit: 48,
			query: "nothing matches",
			space_id: "bookmarks-space-fixture",
		},
		method: "search",
	});
});

test("topic controls filter the saved collection and restore it when toggled", async ({
	page,
}) => {
	const app = await openApp(page, {
		bookmarks: [
			bookmark("topic-research", "Research paper", {
				folder: "Research",
				tags: ["research"],
			}),
			bookmark("topic-design", "Design system", {
				folder: "Design",
				tags: ["design"],
			}),
		],
	});
	const topics = app.getByRole("region", { name: "Current bookmark topics" });
	const designTopic = topics.getByRole("button", {
		name: "design",
		exact: true,
	});
	await designTopic.click();
	await expect(
		app.getByRole("heading", { name: "design", exact: true })
	).toBeVisible();
	await expect(app.getByText("1 shown", { exact: true })).toBeVisible();
	const filteredFolder = app
		.getByRole("group", { name: "Bookmark folders", exact: true })
		.getByRole("button", { name: "design", exact: true });
	await filteredFolder.click();
	const filteredDialog = page.getByRole("dialog");
	await expect(
		filteredDialog.getByRole("button", { name: "Design system", exact: true })
	).toBeVisible();
	await expect(
		filteredDialog.getByRole("button", { name: "Research paper", exact: true })
	).toHaveCount(0);
	await page.getByRole("button", { name: "Close folder" }).click();
	await designTopic.click();
	await expect(app.getByText("2 shown", { exact: true })).toBeVisible();
	// Toggling the topic control changes the rendered collection and restores all saved rows.
	const snapshot = await fixtureSnapshot(page);
	expect(snapshot.state.bookmarks).toHaveLength(2);
});

test("uses the card action triggers to persist favorite, edit, and delete", async ({
	page,
}) => {
	const seeded = bookmark("tooltips", "Reference library", {
		folder: "Reading / Later",
	});
	const app = await openApp(page, { bookmarks: [seeded] });
	await app
		.getByRole("button", { name: "Reading / Later", exact: true })
		.click();
	const cardDialog = page.getByRole("dialog");
	const favorite = cardDialog.getByRole("button", {
		name: "Add favorite",
		exact: true,
	});
	await favorite.focus();
	await expect(favorite).toBeFocused();
	await favorite.click();
	await expect(
		cardDialog.getByRole("button", { name: "Remove favorite" })
	).toBeVisible();
	let snapshot = await fixtureSnapshot(page);
	const savedRecord = snapshot.state.bookmarks.find(
		(item) => item.id === seeded.id
	);
	// The favorite action under its tooltip trigger updates the persisted record.
	expect(JSON.parse(savedRecord?.source ?? "{}")).toMatchObject({
		favorite: true,
		id: seeded.id,
	});
	await cardDialog
		.getByRole("button", { name: "Remove favorite", exact: true })
		.click();
	snapshot = await fixtureSnapshot(page);
	const restoredRecord = snapshot.state.bookmarks.find(
		(item) => item.id === seeded.id
	);
	// Favorite toggling persists both state transitions through the same Space document.
	expect(JSON.parse(restoredRecord?.source ?? "{}")).toMatchObject({
		favorite: false,
		id: seeded.id,
	});
	await cardDialog
		.getByRole("button", { name: "Reference library", exact: true })
		.click();
	snapshot = await fixtureSnapshot(page);
	// Opening a bookmark through its title sends only its saved URL to the host bridge.
	expect(snapshot.externalUrls).toEqual([seeded.url]);
	await cardDialog
		.getByRole("button", { name: "Add favorite", exact: true })
		.click();
	snapshot = await fixtureSnapshot(page);
	expect(
		JSON.parse(
			snapshot.state.bookmarks.find((item) => item.id === seeded.id)?.source ??
				"{}"
		).favorite
	).toBe(true);

	const edit = cardDialog.getByRole("button", {
		name: "Edit Reference library",
		exact: true,
	});
	await edit.focus();
	await expect(edit).toBeFocused();
	await edit.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByLabel("URL")).toHaveValue(seeded.url);
	await dialog.getByLabel("Name").fill("Updated reference library");
	await dialog.getByRole("button", { name: "Update bookmark" }).click();
	await expect(
		cardDialog.getByRole("button", {
			name: "Updated reference library",
			exact: true,
		})
	).toBeVisible();
	await waitForStableLayout(cardDialog.getByRole("article"));
	snapshot = await fixtureSnapshot(page);
	// The edit action trigger updates the same document id and visible title.
	expect(snapshot.state.bookmarks).toHaveLength(1);
	expect(JSON.parse(snapshot.state.bookmarks[0]?.source ?? "{}")).toMatchObject(
		{
			favorite: true,
			id: seeded.id,
			title: "Updated reference library",
		}
	);
	await saveProductScreenshot(page, "bookmarks-card-actions-edited.png");

	const remove = cardDialog.getByRole("button", {
		name: "Delete Updated reference library",
		exact: true,
	});
	await remove.focus();
	await expect(remove).toBeFocused();
	await remove.click();
	await expect(
		page.getByText("No bookmarks yet", { exact: true })
	).toBeVisible();
	snapshot = await fixtureSnapshot(page);
	// The delete action trigger removes only its matching Space document.
	expect(snapshot.state.bookmarks).toHaveLength(0);
	expect(snapshot.calls.at(-1)).toEqual({
		input: { doc_id: seeded.id },
		method: "deleteDoc",
	});
	await saveProductScreenshot(page, "bookmarks-card-actions-after-delete.png");
});

test("shows favorite, edit, and delete tooltips on hover and keyboard focus", async ({
	page,
}) => {
	const seeded = bookmark("tooltip-record", "Tooltip reference", {
		folder: "Reading / Later",
	});
	const app = await openApp(page, { bookmarks: [seeded] });
	await app
		.getByRole("button", { name: "Reading / Later", exact: true })
		.click();
	const cardDialog = page.getByRole("dialog");

	// The favorite tooltip appears on hover and its trigger references it on focus.
	await expectTooltipOnHoverAndFocus(
		page,
		cardDialog.getByRole("button", { name: "Add favorite", exact: true }),
		"Add favorite"
	);
	// The favorite Tooltip root transitions to open and closes after pointer exit or blur.
	// The edit tooltip appears on hover and its trigger references it on focus.
	await expectTooltipOnHoverAndFocus(
		page,
		cardDialog.getByRole("button", {
			name: "Edit Tooltip reference",
			exact: true,
		}),
		"Edit bookmark"
	);
	// The edit Tooltip root transitions to open and closes after pointer exit or blur.
	// The delete tooltip appears on hover and its trigger references it on focus.
	const deleteButton = cardDialog.getByRole("button", {
		name: "Delete Tooltip reference",
		exact: true,
	});
	await expectTooltipOnHoverAndFocus(page, deleteButton, "Delete bookmark");
	// The delete Tooltip root transitions to open and closes after pointer exit or blur.
	await deleteButton.hover();
	await expect(
		page.getByRole("tooltip", { exact: true, name: "Delete bookmark" })
	).toBeVisible();
	await saveProductScreenshot(page, "bookmarks-card-action-tooltips.png");
});
