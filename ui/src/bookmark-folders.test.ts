import { describe, expect, test } from "bun:test";
import {
	groupBookmarks,
	syntheticBookmarkCollection,
} from "./bookmark-folders.ts";
import type { Bookmark } from "./types.ts";

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
	return {
		createdAt: 1,
		description: "",
		favorite: false,
		folder: "",
		id: "bookmark",
		tags: [],
		title: "Bookmark",
		updatedAt: 1,
		url: "https://example.com",
		...overrides,
	};
}

describe("bookmark folders", () => {
	test("prefers explicit browser folders over inferred topics", () => {
		const collections = groupBookmarks([
			bookmark({
				id: "a",
				folder: "Reading / Later",
				tags: ["reading", "example.com"],
				updatedAt: 3,
			}),
			bookmark({ id: "b", folder: "", tags: ["development"], updatedAt: 2 }),
			bookmark({ id: "c", folder: "", tags: ["example.com"], updatedAt: 1 }),
		]);

		expect(collections.map((collection) => collection.label)).toEqual([
			"Reading / Later",
			"development",
			"Unsorted",
		]);
		expect(
			collections.flatMap((collection) => collection.bookmarks)
		).toHaveLength(3);
	});

	test("uses the first recognized topic tag when no folder is present", () => {
		const collections = groupBookmarks([
			bookmark({ id: "a", tags: ["example.com", "research", "design"] }),
		]);

		expect(collections.map((collection) => collection.label)).toEqual([
			"research",
		]);
	});

	test("falls back to Unsorted for bookmarks without a recognized topic", () => {
		const collections = groupBookmarks([
			bookmark({ id: "a", tags: ["example.com", "other"] }),
		]);

		expect(collections.map((collection) => collection.label)).toEqual([
			"Unsorted",
		]);
	});

	test("assigns each bookmark to exactly one collection", () => {
		const bookmarks = [
			bookmark({
				id: "a",
				folder: "  Work  ",
				tags: ["development"],
				updatedAt: 3,
			}),
			bookmark({ id: "b", tags: ["research", "design"], updatedAt: 2 }),
			bookmark({ id: "c", updatedAt: 1 }),
		];
		const collections = groupBookmarks(bookmarks);

		expect(
			collections
				.flatMap((collection) => collection.bookmarks)
				.map((item) => item.id)
		).toEqual(["a", "b", "c"]);
	});

	test("orders collections by newest member, then label", () => {
		const collections = groupBookmarks([
			bookmark({ id: "a", folder: "Beta", updatedAt: 20 }),
			bookmark({ id: "b", folder: "Alpha", updatedAt: 20 }),
			bookmark({ id: "c", folder: "Older", updatedAt: 30 }),
			bookmark({ id: "d", folder: "Beta", updatedAt: 10 }),
		]);

		expect(collections.map((collection) => collection.label)).toEqual([
			"Older",
			"Alpha",
			"Beta",
		]);
		expect(collections[2]?.bookmarks.map((item) => item.id)).toEqual([
			"a",
			"d",
		]);
	});

	test("creates one synthetic collection for a filtered result", () => {
		const result = syntheticBookmarkCollection("Favorites", [
			bookmark({ id: "a" }),
		]);

		expect(result.key).toBe("synthetic:favorites");
		expect(result.label).toBe("Favorites");
		expect(result.bookmarks.map((item) => item.id)).toEqual(["a"]);
	});
});
