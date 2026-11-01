import {
	bookmarkReadbackSchema,
	createdSpaceIdSchema,
	type SpaceDocument,
	type SpaceDocumentSummary,
	type SpaceMatch,
	spaceDocumentReplySchema,
	spaceDocumentSummariesSchema,
	spaceSearchSchema,
	storedSpaceIdSchema,
} from "./schemas.ts";
import type { Bookmark, BookmarkDraft } from "./types.ts";
import { parseBookmarkSource, serializeBookmark } from "./types.ts";

export interface RyuBridge {
	context?: { filter?: string; tag?: string } | null;
	spaces: {
		createDoc(input: { space_id: string; title: string }): Promise<string>;
		deleteDoc(input: { doc_id: string }): Promise<void>;
		ensureSpace(input: {
			name: string;
			description?: string | null;
		}): Promise<string>;
		getDoc(input: { doc_id: string }): Promise<SpaceDocument | null>;
		listDocs(input: {
			space_id: string;
		}): Promise<SpaceDocumentSummary[] | null | undefined>;
		search(input: {
			space_id: string;
			query: string;
			limit?: number;
		}): Promise<SpaceMatch[]>;
		updateDoc(input: {
			doc_id: string;
			source: string;
			title?: string;
		}): Promise<void>;
	};
	storage: {
		get(input: { key: string }): Promise<string | null>;
		set(input: { key: string; value: string }): Promise<void>;
	};
	ui: {
		openExternal(input: { href: string }): Promise<void>;
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
	const parsedStored = storedSpaceIdSchema.safeParse(stored);
	if (parsedStored.success && parsedStored.data.trim()) {
		return parsedStored.data;
	}
	const result = await ryu().spaces.ensureSpace({
		name: "Bookmarks",
		description:
			"Saved links, reading notes, and browser imports organized by Ryu.",
	});
	if (!createdSpaceIdSchema.safeParse(result).success) {
		throw new Error("Ryu did not return a Bookmarks Space id");
	}
	await ryu().storage.set({ key: SPACE_KEY, value: result });
	return result;
}

export async function loadBookmarks(spaceId: string): Promise<Bookmark[]> {
	const summaries = bookmarkReadbackSchema(spaceDocumentSummariesSchema).parse(
		await ryu().spaces.listDocs({ space_id: spaceId })
	);
	const documents = await Promise.all(
		(summaries ?? []).map(async (summary) => {
			const document = bookmarkReadbackSchema(spaceDocumentReplySchema).parse(
				await ryu().spaces.getDoc({ doc_id: summary.id })
			);
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
	if (!createdSpaceIdSchema.safeParse(documentId).success) {
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
	if (!Array.isArray(result)) {
		return [];
	}
	return bookmarkReadbackSchema(spaceSearchSchema).parse(result);
}

export function openBookmark(url: string): void {
	ryu()
		.ui.openExternal({ href: url })
		.catch(() => undefined);
}
