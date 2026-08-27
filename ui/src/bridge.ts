import type { Bookmark, BookmarkDraft } from "./types.ts";
import { parseBookmarkSource, serializeBookmark } from "./types.ts";

interface SpaceDocumentSummary {
	id: string;
	title: string;
	updated_at: number;
}

interface SpaceDocument {
	id: string;
	kind: string;
	source: string;
	title: string;
}

interface SpaceMatch {
	content: string;
	distance: number;
	document_id: string;
}

interface RyuBridge {
	spaces: {
		createDoc(input: { space_id: string; title: string }): Promise<unknown>;
		deleteDoc(input: { doc_id: string }): Promise<unknown>;
		ensureSpace(input: {
			name: string;
			description?: string | null;
		}): Promise<unknown>;
		getDoc(input: { doc_id: string }): Promise<unknown>;
		listDocs(input: { space_id: string }): Promise<unknown>;
		search(input: {
			space_id: string;
			query: string;
			limit?: number;
		}): Promise<unknown>;
		updateDoc(input: {
			doc_id: string;
			source: string;
			title?: string;
		}): Promise<unknown>;
	};
	storage: {
		get(input: { key: string }): Promise<unknown>;
		set(input: { key: string; value: string }): Promise<unknown>;
	};
	ui: {
		openExternal(input: { href: string }): Promise<unknown>;
	};
}

declare global {
	interface Window {
		ryu?: RyuBridge;
	}
}

const SPACE_KEY = "bookmarks.space_id";

function ryu(): RyuBridge {
	if (!window.ryu) {
		throw new Error("The Bookmarks bridge is not connected");
	}
	return window.ryu;
}

export async function ensureBookmarksSpace(): Promise<string> {
	const stored = await ryu().storage.get({ key: SPACE_KEY });
	if (typeof stored === "string" && stored.trim()) {
		return stored;
	}
	const result = await ryu().spaces.ensureSpace({
		name: "Bookmarks",
		description:
			"Saved links, reading notes, and browser imports organized by Ryu.",
	});
	if (typeof result !== "string" || result.length === 0) {
		throw new Error("Ryu did not return a Bookmarks Space id");
	}
	await ryu().storage.set({ key: SPACE_KEY, value: result });
	return result;
}

export async function loadBookmarks(spaceId: string): Promise<Bookmark[]> {
	const summaries = (await ryu().spaces.listDocs({ space_id: spaceId })) as
		| SpaceDocumentSummary[]
		| undefined;
	const documents = await Promise.all(
		(summaries ?? []).map(async (summary) => {
			const document = (await ryu().spaces.getDoc({
				doc_id: summary.id,
			})) as SpaceDocument | null;
			const bookmark = document ? parseBookmarkSource(document.source) : null;
			return bookmark ? { ...bookmark, id: document?.id ?? bookmark.id } : null;
		})
	);
	return documents.filter(
		(bookmark): bookmark is Bookmark => bookmark !== null
	);
}

export async function createBookmark(
	spaceId: string,
	draft: BookmarkDraft,
	tags: string[]
): Promise<Bookmark> {
	const now = Date.now();
	const title = draft.title.trim() || draft.url;
	const documentId = await ryu().spaces.createDoc({
		space_id: spaceId,
		title,
	});
	if (typeof documentId !== "string" || documentId.length === 0) {
		throw new Error("Ryu did not return a bookmark document id");
	}
	const bookmark: Bookmark = {
		createdAt: now,
		description: draft.description?.trim() ?? "",
		favorite: false,
		folder: draft.folder?.trim() ?? "",
		id: documentId,
		tags,
		title,
		updatedAt: now,
		url: draft.url,
	};
	try {
		await ryu().spaces.updateDoc({
			doc_id: documentId,
			source: serializeBookmark(bookmark),
			title,
		});
	} catch (error) {
		await ryu()
			.spaces.deleteDoc({ doc_id: documentId })
			.catch(() => undefined);
		throw error;
	}
	return bookmark;
}

export async function updateBookmark(bookmark: Bookmark): Promise<void> {
	await ryu().spaces.updateDoc({
		doc_id: bookmark.id,
		source: serializeBookmark(bookmark),
		title: bookmark.title,
	});
}

export async function deleteBookmark(id: string): Promise<void> {
	await ryu().spaces.deleteDoc({ doc_id: id });
}

export async function searchBookmarks(
	spaceId: string,
	query: string
): Promise<SpaceMatch[]> {
	const result = await ryu().spaces.search({
		space_id: spaceId,
		query,
		limit: 48,
	});
	return Array.isArray(result) ? (result as SpaceMatch[]) : [];
}

export function openBookmark(url: string): void {
	ryu()
		.ui.openExternal({ href: url })
		.catch(() => undefined);
}
