import { describe, expect, it } from "bun:test";
import {
	bookmarkReadbackSchema,
	bookmarkSchema,
	spaceDocumentSummariesSchema,
	spaceSearchSchema,
} from "./schemas.ts";
import { type Bookmark, parseBookmarkSource } from "./types.ts";

const bookmark: Bookmark = {
	createdAt: 17,
	description: "Note",
	favorite: false,
	folder: "Reading",
	id: "bookmark-1",
	tags: ["research"],
	title: "Research",
	updatedAt: 18,
	url: "https://example.test/",
};

describe("Bookmark and Space readback contracts", () => {
	it("keeps valid bookmark fields and future metadata through stored JSON", () => {
		const input = {
			...bookmark,
			metadata: { source: "Core" },
			["__proto__"]: { legacy: true },
		};
		expect(bookmarkSchema.parse(input)).toBe(input);
		const parsed = parseBookmarkSource(JSON.stringify(input));
		expect(parsed).toEqual(input);
		expect(Object.hasOwn(parsed ?? {}, "__proto__")).toBe(true);
	});
	it("rejects malformed numeric, favorite and tag fields without coercion", () => {
		expect(
			parseBookmarkSource(JSON.stringify({ ...bookmark, createdAt: "17" }))
		).toBeNull();
		expect(
			parseBookmarkSource(JSON.stringify({ ...bookmark, favorite: "false" }))
		).toBeNull();
		expect(
			parseBookmarkSource(JSON.stringify({ ...bookmark, tags: [7] }))
		).toBeNull();
	});
	it("retains legacy empty lists and search identity while checking each match", () => {
		expect(spaceDocumentSummariesSchema.parse(undefined)).toBeUndefined();
		expect(spaceDocumentSummariesSchema.parse(null)).toBeNull();
		const matches = [
			{
				content: "Match",
				distance: 0.1,
				document_id: "bookmark-1",
				metadata: { source: "Core" },
			},
		];
		const parsed = bookmarkReadbackSchema(spaceSearchSchema).parse(matches);
		expect(parsed === matches).toBe(true);
		expect(
			spaceSearchSchema.safeParse([
				{ content: "Match", distance: "0.1", document_id: "bookmark-1" },
			]).success
		).toBe(false);
	});
});
