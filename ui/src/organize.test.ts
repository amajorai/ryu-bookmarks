import { describe, expect, test } from "bun:test";
import { collectionLabel, inferBookmarkTags } from "./organize.ts";

describe("bookmark organization", () => {
	test("infers useful topics from a saved link", () => {
		const tags = inferBookmarkTags({
			folder: "Reading / Design",
			title: "A practical guide to typography systems",
			url: "https://www.figma.com/blog/type-systems",
		});

		expect(tags).toContain("design");
		expect(tags).toContain("figma.com");
		expect(tags).toContain("folder:reading-design");
	});

	test("keeps unknown links searchable with a stable fallback", () => {
		expect(
			inferBookmarkTags({
				title: "A small corner",
				url: "https://example.com/quiet",
			})
		).toEqual(["example.com"]);
		expect(collectionLabel("folder:reading-design")).toBe("reading design");
	});
});
