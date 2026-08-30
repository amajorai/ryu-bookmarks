import type { Bookmark } from "./types.ts";

export interface BookmarkCollection {
	bookmarks: Bookmark[];
	key: string;
	label: string;
}

const RECOGNIZED_TOPICS = new Set([
	"design",
	"development",
	"research",
	"product",
	"recipes",
	"watch",
	"reading",
]);

function sortBookmarks(bookmarks: Bookmark[]): Bookmark[] {
	return [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt);
}

function syntheticKey(label: string): string {
	return `synthetic:${label.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

function collectionFor(bookmark: Bookmark): { key: string; label: string } {
	const folder = bookmark.folder.trim();
	if (folder) {
		return { key: `folder:${folder}`, label: folder };
	}

	for (const tag of bookmark.tags) {
		const topic = tag.trim().toLowerCase();
		if (RECOGNIZED_TOPICS.has(topic)) {
			return { key: `topic:${topic}`, label: topic };
		}
	}

	return { key: "unsorted", label: "Unsorted" };
}

export function groupBookmarks(bookmarks: Bookmark[]): BookmarkCollection[] {
	const grouped = new Map<string, BookmarkCollection>();

	for (const bookmark of sortBookmarks(bookmarks)) {
		const { key, label } = collectionFor(bookmark);
		const collection = grouped.get(key);
		if (collection) {
			collection.bookmarks.push(bookmark);
			continue;
		}
		grouped.set(key, { bookmarks: [bookmark], key, label });
	}

	return [...grouped.values()].sort((a, b) => {
		const newestA = a.bookmarks[0]?.updatedAt ?? 0;
		const newestB = b.bookmarks[0]?.updatedAt ?? 0;
		if (newestA !== newestB) {
			return newestB - newestA;
		}
		return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
	});
}

export function syntheticBookmarkCollection(
	label: string,
	bookmarks: Bookmark[]
): BookmarkCollection {
	return {
		bookmarks: [...bookmarks],
		key: syntheticKey(label),
		label,
	};
}
