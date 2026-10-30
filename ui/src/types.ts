import { bookmarkSchema } from "./schemas.ts";
export interface Bookmark {
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

export interface BookmarkDraft {
	description?: string;
	folder?: string;
	tags?: string[];
	title: string;
	url: string;
}

export interface ImportedBookmark {
	description: string;
	folder: string;
	title: string;
	url: string;
}

export function domainForUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "unknown source";
	}
}

export function serializeBookmark(bookmark: Bookmark): string {
	return JSON.stringify(bookmark);
}

export function parseBookmarkSource(source: string): Bookmark | null {
	try {
		const parsed = bookmarkSchema.safeParse(JSON.parse(source));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
