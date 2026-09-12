import { describe, expect, test } from "bun:test";
import { normalizeImportedBookmark } from "./html-import.ts";

describe("bookmark import normalization", () => {
	test("accepts browser URLs and supplies a fallback title", () => {
		expect(
			normalizeImportedBookmark({ url: "https://www.example.com/notes" })
		).toEqual({
			description: "",
			folder: "",
			title: "example.com",
			url: "https://www.example.com/notes",
		});
	});

	test("rejects executable or missing URLs", () => {
		expect(
			normalizeImportedBookmark({ url: "javascript:alert(1)" })
		).toBeNull();
		expect(normalizeImportedBookmark({ title: "Missing URL" })).toBeNull();
	});
});
