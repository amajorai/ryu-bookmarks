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

function isBookmark(value: unknown): value is Bookmark {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.id === "string" &&
		typeof record.title === "string" &&
		typeof record.url === "string" &&
		typeof record.createdAt === "number" &&
		typeof record.updatedAt === "number" &&
		typeof record.description === "string" &&
		typeof record.folder === "string" &&
		typeof record.favorite === "boolean" &&
		Array.isArray(record.tags) &&
		record.tags.every((tag) => typeof tag === "string")
	);
}

export function parseBookmarkSource(source: string): Bookmark | null {
	try {
		const value: unknown = JSON.parse(source);
		return isBookmark(value) ? value : null;
	} catch {
		return null;
	}
}
