import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import type { RyuBridge } from "./bridge.ts";
import { bookmarkSchema } from "./schemas.ts";
import type { Bookmark } from "./types.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Bookmarks } = await import("./App.tsx");

interface SpaceDocument {
	id: string;
	kind: string;
	source: string;
	title: string;
	updated_at: number;
}

interface BridgeState {
	beforeList: (() => Promise<void>) | null;
	beforeUpdate:
		| ((
				input: Parameters<RyuBridge["spaces"]["updateDoc"]>[0]
		  ) => Promise<void>)
		| null;
	bookmarks: Map<string, SpaceDocument>;
	calls: Array<{
		input: Parameters<RyuBridge["spaces"][keyof RyuBridge["spaces"]]>[0];
		method: keyof RyuBridge["spaces"];
	}>;
	externalUrls: string[];
	searchIds: string[] | null;
}

interface MountedApp {
	container: HTMLDivElement;
	root: Root;
}

const mountedApps: MountedApp[] = [];
let bridgeState: BridgeState;

async function tick(delay = 0): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, delay));
}

function installBridge(bookmarks: Bookmark[] = []): void {
	bridgeState = {
		beforeList: null,
		beforeUpdate: null,
		bookmarks: new Map(
			bookmarks.map((bookmark) => [
				bookmark.id,
				{
					id: bookmark.id,
					kind: "bookmark",
					source: JSON.stringify(bookmark),
					title: bookmark.title,
					updated_at: bookmark.updatedAt,
				},
			])
		),
		calls: [],
		externalUrls: [],
		searchIds: null,
	};
	const storage = new Map<string, string>();
	Reflect.set(window, "ryu", {
		storage: {
			get: async (input: { key: string }) => storage.get(input.key) ?? null,
			set: async (input: { key: string; value: string }) => {
				storage.set(input.key, input.value);
			},
		},
		spaces: {
			createDoc: async (input: { space_id: string; title: string }) => {
				bridgeState.calls.push({ input, method: "createDoc" });
				const id = `bookmark-${bridgeState.bookmarks.size + 1}`;
				bridgeState.bookmarks.set(id, {
					id,
					kind: "bookmark",
					source: "",
					title: input.title,
					updated_at: Date.now(),
				});
				return id;
			},
			deleteDoc: async (input: { doc_id: string }) => {
				bridgeState.calls.push({ input, method: "deleteDoc" });
				bridgeState.bookmarks.delete(input.doc_id);
			},
			ensureSpace: async (input: { name: string }) => {
				bridgeState.calls.push({ input, method: "ensureSpace" });
				return "bookmarks-space-fixture";
			},
			getDoc: async (input: { doc_id: string }) => {
				bridgeState.calls.push({ input, method: "getDoc" });
				return bridgeState.bookmarks.get(input.doc_id) ?? null;
			},
			listDocs: async (input: { space_id: string }) => {
				bridgeState.calls.push({ input, method: "listDocs" });
				await bridgeState.beforeList?.();
				return [...bridgeState.bookmarks.values()].map(
					({ id, title, updated_at }) => ({ id, title, updated_at })
				);
			},
			search: async (input: { query: string; space_id: string }) => {
				bridgeState.calls.push({ input, method: "search" });
				return bridgeState.searchIds
					? bridgeState.searchIds.map((document_id) => ({
							content: "fixture match",
							distance: 0.1,
							document_id,
						}))
					: [];
			},
			updateDoc: async (input: {
				doc_id: string;
				source: string;
				title?: string;
			}) => {
				bridgeState.calls.push({ input, method: "updateDoc" });
				await bridgeState.beforeUpdate?.(input);
				bridgeState.bookmarks.set(input.doc_id, {
					id: input.doc_id,
					kind: "bookmark",
					source: input.source,
					title: input.title ?? "",
					updated_at: Date.now(),
				});
			},
		},
		ui: {
			openExternal: async (input: { href: string }) => {
				bridgeState.externalUrls.push(input.href);
			},
		},
	});
}

async function mountApp(): Promise<HTMLDivElement> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	mountedApps.push({ container, root });
	await act(async () => {
		root.render(<Bookmarks />);
		await tick(10);
	});
	return container;
}

function findButton(scope: ParentNode, name: string): HTMLButtonElement {
	const button = [...scope.querySelectorAll("button")].find(
		(candidate) =>
			candidate.getAttribute("aria-label") === name ||
			candidate.textContent?.replace(/\s+/g, " ").trim() === name
	);
	if (!(button instanceof HTMLButtonElement)) {
		const availableButtons = [...scope.querySelectorAll("button")]
			.map(
				(candidate) =>
					candidate.getAttribute("aria-label") ||
					candidate.textContent?.replace(/\s+/g, " ").trim() ||
					"(unnamed button)"
			)
			.join(" | ");
		throw new Error(
			`Could not find Bookmarks button: ${name}. Available buttons: ${availableButtons}`
		);
	}
	return button;
}

async function clickButton(
	scope: ParentNode,
	name: string,
	delay = 0
): Promise<void> {
	await act(async () => {
		findButton(scope, name).click();
		await tick(delay);
	});
}

async function setField(id: string, value: string): Promise<void> {
	const field = document.getElementById(id);
	if (
		!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
	) {
		throw new Error(`Could not find Bookmarks field: ${id}`);
	}
	await act(async () => {
		field.focus();
		const setter = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(field),
			"value"
		)?.set;
		if (setter) {
			setter.call(field, value);
		} else {
			field.value = value;
		}
		field.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();
	});
}

afterEach(async () => {
	for (const { container, root } of mountedApps.splice(0)) {
		await act(async () => root.unmount());
		container.remove();
	}
	Reflect.set(window, "ryu", undefined);
});

describe("Bookmarks rendered library workflows", () => {
	test("a refused initial load remains retryable when the retry is also refused", async () => {
		installBridge();
		let refusal = new Error("Bookmarks access is temporarily unavailable.");
		bridgeState.beforeList = () => Promise.reject(refusal);
		const container = await mountApp();
		expect(document.querySelector('[role="alert"]')?.textContent).toContain(
			refusal.message
		);
		expect(
			bridgeState.calls.filter((call) => call.method === "listDocs")
		).toHaveLength(1);

		refusal = new Error("Bookmarks access is still unavailable.");
		await clickButton(container, "Try again", 10);
		expect(document.querySelector('[role="alert"]')?.textContent).toContain(
			refusal.message
		);
		expect(
			bridgeState.calls.filter((call) => call.method === "listDocs")
		).toHaveLength(2);

		bridgeState.beforeList = null;
		await clickButton(container, "Try again", 10);
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(container.textContent).toContain("No bookmarks yet");
		expect(
			bridgeState.calls.filter((call) => call.method === "listDocs")
		).toHaveLength(3);
	});

	test("a refused folder move keeps the saved record and draft, then retries with readback", async () => {
		const bookmark: Bookmark = {
			createdAt: 10,
			description: "Author's notes",
			favorite: true,
			folder: "Reading / Later",
			id: "existing-research-link",
			tags: ["research", "folder:reading-later", "example.test"],
			title: "Research notes",
			updatedAt: 20,
			url: "https://example.test/research",
		};
		installBridge([bookmark]);
		const original = bridgeState.bookmarks.get(bookmark.id);
		const container = await mountApp();
		await clickButton(container, "Reading / Later");
		await clickButton(document.body, "Edit Research notes");
		await setField("bookmark-folder", "  Projects / Launch  ");
		let rejectUpdate: ((error: Error) => void) | undefined;
		bridgeState.beforeUpdate = () =>
			new Promise<void>((_resolve, reject) => {
				rejectUpdate = reject;
			});
		const start = bridgeState.calls.length;
		await clickButton(document.body, "Update bookmark");
		expect(findButton(document.body, "Updating…").disabled).toBe(true);
		expect(bridgeState.bookmarks.get(bookmark.id)).toEqual(original);
		await act(async () => {
			if (!rejectUpdate) {
				throw new Error(
					"The production bookmark update did not reach the bridge"
				);
			}
			rejectUpdate(
				new Error(
					"This Space does not allow editing this bookmark. Try again after access is restored."
				)
			);
			await tick();
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toBe(
			"This Space does not allow editing this bookmark. Try again after access is restored."
		);
		expect(
			document.querySelector<HTMLInputElement>("#bookmark-folder")?.value
		).toBe("  Projects / Launch  ");
		expect(findButton(document.body, "Update bookmark").disabled).toBe(false);
		expect(bridgeState.bookmarks.get(bookmark.id)).toEqual(original);
		expect(bridgeState.calls.slice(start).map((call) => call.method)).toEqual([
			"updateDoc",
		]);

		bridgeState.beforeUpdate = null;
		await clickButton(document.body, "Update bookmark", 20);
		expect(document.querySelector('[role="alert"]')).toBeNull();
		const attempts = bridgeState.calls
			.slice(start)
			.filter((call) => call.method === "updateDoc");
		expect(attempts).toHaveLength(2);
		for (const { input } of attempts) {
			expect(Object.keys(input).sort()).toEqual(["doc_id", "source", "title"]);
			if (!("source" in input)) {
				throw new Error("The production caller did not serialize its bookmark");
			}
			expect(input.doc_id).toBe(bookmark.id);
			expect(input.title).toBe(bookmark.title);
			expect(JSON.parse(input.source)).toMatchObject({
				...bookmark,
				folder: "Projects / Launch",
				tags: ["research", "folder:projects-launch", "example.test"],
				updatedAt: expect.any(Number),
			});
		}
		expect(bridgeState.calls.slice(start).map((call) => call.method)).toEqual([
			"updateDoc",
			"updateDoc",
			"listDocs",
			"getDoc",
		]);
		expect(bridgeState.calls.at(-1)?.input).toEqual({ doc_id: bookmark.id });
		expect(
			JSON.parse(bridgeState.bookmarks.get(bookmark.id)?.source ?? "null")
		).toMatchObject({
			id: bookmark.id,
			folder: "Projects / Launch",
			favorite: true,
			createdAt: 10,
		});
		expect(bridgeState.bookmarks.size).toBe(1);
		expect(findButton(container, "Projects / Launch")).toBeDefined();
		expect(bridgeState.externalUrls).toEqual([]);

		const firstMount = mountedApps.pop();
		if (!firstMount) {
			throw new Error("The actual Bookmarks app was not mounted");
		}
		await act(async () => firstMount.root.unmount());
		firstMount.container.remove();
		const reloaded = await mountApp();
		await clickButton(reloaded, "Projects / Launch");
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
			"Research notes"
		);
		expect(
			document.querySelector('[role="dialog"]')?.textContent
		).not.toContain("Reading / Later");
	});

	test("creates, edits, favorites, opens, and deletes a saved link through the Space bridge", async () => {
		installBridge();
		const container = await mountApp();
		expect(container.textContent).toContain("No bookmarks yet");

		await clickButton(container, "Add a bookmark");
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
			);
			await tick(10);
		});
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		await clickButton(container, "Add bookmark");
		await setField("bookmark-url", "https://www.example.test/research");
		await setField("bookmark-title", "Research notes");
		await setField("bookmark-description", "Keep the launch checklist close.");
		await setField("bookmark-folder", "Reading / Later");
		await clickButton(document.body, "Save bookmark", 20);

		const id = [...bridgeState.bookmarks.keys()][0];
		expect(id).toBe("bookmark-1");
		const saved = bookmarkSchema.parse(
			JSON.parse(bridgeState.bookmarks.get(id ?? "")?.source ?? "{}")
		);
		expect(saved).toMatchObject({
			description: "Keep the launch checklist close.",
			folder: "Reading / Later",
			favorite: false,
			title: "Research notes",
			url: "https://www.example.test/research",
		});
		expect(bridgeState.calls.some((call) => call.method === "createDoc")).toBe(
			true
		);
		expect(container.textContent).toContain("Reading / Later");

		await clickButton(document.body, "Reading / Later");
		await act(async () => tick(20));
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
			"Research notes"
		);
		await clickButton(document.body, "Add favorite");
		expect(
			JSON.parse(bridgeState.bookmarks.get(id ?? "")?.source ?? "{}").favorite
		).toBe(true);
		await clickButton(document.body, "Remove favorite");
		expect(
			JSON.parse(bridgeState.bookmarks.get(id ?? "")?.source ?? "{}").favorite
		).toBe(false);

		await clickButton(document.body, "Research notes");
		expect(bridgeState.externalUrls).toEqual([
			"https://www.example.test/research",
		]);
		await clickButton(document.body, "Reading / Later");
		await clickButton(document.body, "Edit Research notes");
		await setField("bookmark-title", "Launch checklist");
		await setField("bookmark-folder", "Product / Launch");
		await clickButton(document.body, "Update bookmark", 20);
		expect(
			JSON.parse(bridgeState.bookmarks.get(id ?? "")?.source ?? "{}")
		).toMatchObject({ title: "Launch checklist", folder: "Product / Launch" });

		await clickButton(document.body, "Product / Launch");
		await clickButton(document.body, "Delete Launch checklist");
		expect(bridgeState.bookmarks.has(id ?? "")).toBe(false);
		expect(container.textContent).toContain("No bookmarks yet");

		await clickButton(container, "Add bookmark");
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await clickButton(document.body, "Cancel");
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	test("semantic search shows only returned ids and restores the full library", async () => {
		const bookmark: Bookmark = {
			createdAt: 10,
			description: "Vector retrieval notes",
			favorite: false,
			folder: "Research",
			id: "vector-doc",
			tags: ["research"],
			title: "Vector databases",
			updatedAt: 20,
			url: "https://example.test/vector",
		};
		installBridge([bookmark]);
		bridgeState.searchIds = [bookmark.id];
		const container = await mountApp();
		const query = container.querySelector<HTMLInputElement>(
			'[aria-label="Search bookmarks semantically"]'
		);
		expect(query).not.toBeNull();
		if (!query) {
			throw new Error("The semantic search field did not render.");
		}
		await act(async () => {
			query.focus();
			const setter = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(query),
				"value"
			)?.set;
			setter?.call(query, "vector index");
			query.dispatchEvent(new Event("input", { bubbles: true }));
			await tick();
		});
		await clickButton(container, "Semantic search", 20);
		expect(bridgeState.calls.at(-1)).toEqual({
			input: {
				limit: 48,
				query: "vector index",
				space_id: "bookmarks-space-fixture",
			},
			method: "search",
		});
		expect(container.querySelector("h2")?.textContent).toContain(
			"Semantic matches for “vector index”"
		);
		await clickButton(document.body, "Semantic matches for “vector index”");
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
			"Vector databases"
		);
		await clickButton(document.body, "Close folder");

		await clickButton(container, "Show everything");
		expect(container.querySelector("h2")?.textContent).toContain(
			"All bookmarks"
		);
		await act(async () => {
			query.focus();
			const setter = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(query),
				"value"
			)?.set;
			setter?.call(query, "vector index");
			query.dispatchEvent(new Event("input", { bubbles: true }));
			await tick();
		});
		await clickButton(container, "Semantic search", 20);
		await clickButton(container, "Clear search");
		expect(query.value).toBe("");
		expect(container.textContent).not.toContain(
			"Ryu found the closest ideas in your library."
		);
		const researchTopic = container.querySelector<HTMLButtonElement>(
			"button[data-topic-active]"
		);
		expect(researchTopic?.textContent).toContain("research");
		if (!researchTopic) {
			throw new Error("The inferred Research topic did not render.");
		}
		await act(async () => {
			researchTopic.click();
			await tick();
		});
		expect(
			container.querySelector('[data-topic-active="true"]')?.textContent
		).toContain("research");
	});
});
