import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	namedAssertionIsPresent,
	reconcileLocalInteractionMap,
} from "../../../../apps-store/companion-suite.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../../../");
const inventoryPath = resolve(
	repositoryRoot,
	"docs/proof/test-coverage-sweep-20260924/companion-interaction-inventory.tsv"
);
const mapPath = resolve(import.meta.dirname, "companion-interactions.json");
const specPath = resolve(import.meta.dirname, "bookmarks-companion.spec.ts");

function parseTsv(source) {
	const [headerLine, ...lines] = source.trimEnd().split("\n");
	const headers = headerLine?.split("\t") ?? [];
	return lines.map((line) => {
		const values = line.split("\t");
		return Object.fromEntries(
			headers.map((header, index) => [header, values[index] ?? ""])
		);
	});
}

const censusRows = parseTsv(readFileSync(inventoryPath, "utf8"));
const map = JSON.parse(readFileSync(mapPath, "utf8"));
const specSource = readFileSync(specPath, "utf8");

describe("Bookmarks package-owned interaction map", () => {
	test("joins all eighteen behavior assertions to current census rows and browser tests", () => {
		const reconciled = reconcileLocalInteractionMap(
			"bookmarks",
			censusRows,
			map
		);
		expect(reconciled).toHaveLength(18);
		for (const { assertion } of reconciled) {
			expect(
				namedAssertionIsPresent(
					specSource,
					assertion.testTitle,
					assertion.assertionMarker
				)
			).toBe(true);
		}
	});

	test("rejects duplicate identities and stale line mappings", () => {
		const first = map.assertions[0];
		expect(first).toBeDefined();
		expect(() =>
			reconcileLocalInteractionMap("bookmarks", censusRows, {
				...map,
				assertions: [first, { ...first }],
				expectedRows: 2,
			})
		).toThrow("duplicates an interaction identity");

		const stale = { ...first, row: { ...first.row, line: "99999" } };
		expect(() =>
			reconcileLocalInteractionMap("bookmarks", censusRows, {
				...map,
				assertions: [stale],
				expectedRows: 1,
			})
		).toThrow("does not match exactly one current central census row");
	});
});
