import type { ImportedBookmark } from "./types.ts";

function directChild(element: Element, tagName: string): Element | null {
	const wanted = tagName.toUpperCase();
	return (
		Array.from(element.children).find((child) => child.tagName === wanted) ??
		null
	);
}

export function normalizeImportedBookmark(input: {
	description?: string;
	folder?: string;
	title?: string;
	url?: string;
}): ImportedBookmark | null {
	if (!input.url) {
		return null;
	}
	let parsed: URL;
	try {
		parsed = new URL(input.url.trim());
	} catch {
		return null;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return null;
	}
	return {
		description: input.description?.trim() ?? "",
		folder: input.folder?.trim() ?? "",
		title: input.title?.trim() || parsed.hostname.replace(/^www\./, ""),
		url: parsed.toString(),
	};
}

/** Parse the HTML export format shared by Chrome, Firefox, Safari, and Edge. */
export function parseBookmarksHtml(markup: string): ImportedBookmark[] {
	if (typeof DOMParser === "undefined") {
		throw new Error("HTML bookmark import is unavailable in this host");
	}
	const document = new DOMParser().parseFromString(markup, "text/html");
	const result: ImportedBookmark[] = [];
	const seen = new Set<string>();

	const add = (anchor: Element, folder: string): void => {
		const item = normalizeImportedBookmark({
			description: anchor.nextElementSibling?.textContent ?? "",
			folder,
			title: anchor.textContent ?? "",
			url: anchor.getAttribute("href") ?? "",
		});
		if (item && !seen.has(item.url)) {
			seen.add(item.url);
			result.push(item);
		}
	};

	const walk = (list: Element, folders: string[]): void => {
		for (const child of Array.from(list.children)) {
			if (child.tagName !== "DT") {
				continue;
			}
			const heading = directChild(child, "h3");
			const nested = directChild(child, "dl");
			const anchor = directChild(child, "a");
			if (anchor) {
				add(anchor, folders.join(" / "));
			}
			if (nested) {
				walk(
					nested,
					heading?.textContent?.trim()
						? [...folders, heading.textContent.trim()]
						: folders
				);
			}
		}
	};

	const root =
		document.querySelector("body > dl") ?? document.querySelector("dl");
	if (root) {
		walk(root, []);
	} else {
		for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
			add(anchor, "");
		}
	}
	return result.slice(0, 5000);
}
