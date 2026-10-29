import type { RyuBridge } from "../src/bridge.ts";
import { bookmarksFixtureStateSchema } from "./bookmarks-fixture.schema.ts";

// Finite local Space adapter shared with companion workflows; no SQL or provider proof.
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

interface SpaceDocument {
	id: string;
	kind: "bookmark";
	source: string;
	title: string;
	updated_at: number;
}

interface BridgeCall {
	input: Parameters<RyuBridge["spaces"][keyof RyuBridge["spaces"]]>[0];
	method: keyof RyuBridge["spaces"];
}

interface FixtureState {
	bookmarks: SpaceDocument[];
	searchIds: string[] | null;
}

interface BookmarkFixture {
	calls: BridgeCall[];
	externalUrls: string[];
	state: FixtureState;
}

declare global {
	interface Window {
		__bookmarksFixture?: BookmarkFixture;
	}
}

export interface BookmarksHostOptions {
	failEnsureSpace: number;
	failUpdateNumber?: number;
	fixedNow?: number;
	initialBookmarks: BookmarkRecord[];
	searchIds: string[] | null;
	storageKey: string;
}
export function installBookmarksHost({
	storageKey,
	initialBookmarks,
	failEnsureSpace,
	searchIds,
	failUpdateNumber,
	fixedNow,
}: BookmarksHostOptions) {
	const saved = localStorage.getItem(storageKey);
	const state: FixtureState = saved
		? bookmarksFixtureStateSchema.parse(JSON.parse(saved))
		: {
				bookmarks: initialBookmarks.map(
					(item): SpaceDocument => ({
						id: item.id,
						kind: "bookmark",
						source: JSON.stringify(item),
						title: item.title,
						updated_at: item.updatedAt,
					})
				),
				searchIds,
			};
	const fixture: BookmarkFixture = {
		calls: [],
		externalUrls: [],
		state,
	};
	let ensureSpaceFailures = failEnsureSpace;
	let nextId = 1;
	let updateNumber = 0;
	if (fixedNow !== undefined) {
		Date.now = () => fixedNow;
	}
	const record = (method: BridgeCall["method"], input: BridgeCall["input"]) => {
		fixture.calls.push({ method, input: structuredClone(input) });
	};
	const persist = () => {
		localStorage.setItem(storageKey, JSON.stringify(fixture.state));
	};
	window.__bookmarksFixture = fixture;
	Reflect.set(window, "ryu", {
		storage: {
			get: async ({ key }: { key: string }) =>
				key === "bookmarks.space_id"
					? localStorage.getItem(`${storageKey}:space`)
					: null,
			set: async ({ key, value }: { key: string; value: string }) => {
				if (key === "bookmarks.space_id") {
					localStorage.setItem(`${storageKey}:space`, value);
				}
			},
		},
		spaces: {
			createDoc: async (input: { space_id: string; title: string }) => {
				record("createDoc", input);
				const id = `bookmark-created-${nextId++}`;
				fixture.state.bookmarks.push({
					id,
					kind: "bookmark",
					source: "",
					title: input.title,
					updated_at: Date.now(),
				});
				persist();
				return id;
			},
			deleteDoc: async (input: { doc_id: string }) => {
				record("deleteDoc", input);
				fixture.state.bookmarks = fixture.state.bookmarks.filter(
					(item) => item.id !== input.doc_id
				);
				persist();
			},
			ensureSpace: async (input: {
				name: string;
				description?: string | null;
			}) => {
				record("ensureSpace", input);
				if (ensureSpaceFailures > 0) {
					ensureSpaceFailures -= 1;
					throw new Error("The local Space fixture is temporarily unavailable");
				}
				return "bookmarks-space-fixture";
			},
			getDoc: async (input: { doc_id: string }) => {
				record("getDoc", input);
				return (
					fixture.state.bookmarks.find((item) => item.id === input.doc_id) ??
					null
				);
			},
			listDocs: async (input: { space_id: string }) => {
				record("listDocs", input);
				return fixture.state.bookmarks.map(({ id, title, updated_at }) => ({
					id,
					title,
					updated_at,
				}));
			},
			search: async (input: {
				limit?: number;
				query: string;
				space_id: string;
			}) => {
				record("search", input);
				return (fixture.state.searchIds ?? []).map((document_id) => ({
					content: "fixture semantic match",
					distance: 0.12,
					document_id,
				}));
			},
			updateDoc: async (input: {
				doc_id: string;
				source: string;
				title?: string;
			}) => {
				record("updateDoc", input);
				updateNumber += 1;
				if (updateNumber === failUpdateNumber) {
					throw new Error(
						"Bookmark storage temporarily unavailable. Retry this save."
					);
				}
				const document = fixture.state.bookmarks.find(
					(item) => item.id === input.doc_id
				);
				if (!document) {
					throw new Error(`Bookmark fixture not found: ${input.doc_id}`);
				}
				document.source = input.source;
				document.title = input.title ?? document.title;
				document.updated_at = Date.now();
				persist();
			},
		},
		ui: {
			openExternal: async ({ href }: { href: string }) => {
				fixture.externalUrls.push(href);
			},
		},
	});
}
