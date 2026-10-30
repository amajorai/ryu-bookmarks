import type { Bookmark } from "./types.ts";

export type Filter = "all" | "favorites" | "recent";

export function initialFilter(): Filter {
	const requested = globalThis.window ? window.ryu?.context?.filter : undefined;
	return requested === "favorites" || requested === "recent"
		? requested
		: "all";
}

export interface TopicCount {
	count: number;
	tag: string;
}

export function sortBookmarks(bookmarks: Bookmark[]): Bookmark[] {
	return [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt);
}
