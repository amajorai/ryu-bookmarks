import { domainForUrl } from "./types.ts";

const TOPIC_RULES = [
	{
		needles: ["design", "figma", "ux", "ui", "css", "typography"],
		tag: "design",
	},
	{
		needles: ["code", "github", "gitlab", "api", "typescript", "rust", "react"],
		tag: "development",
	},
	{
		needles: ["research", "paper", "journal", "study", "arxiv"],
		tag: "research",
	},
	{
		needles: ["product", "startup", "saas", "strategy", "business"],
		tag: "product",
	},
	{ needles: ["recipe", "cook", "food", "kitchen"], tag: "recipes" },
	{ needles: ["video", "youtube", "vimeo", "watch"], tag: "watch" },
	{
		needles: ["read", "article", "essay", "blog", "newsletter"],
		tag: "reading",
	},
] as const;

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 28);
}

/** Infer a small, stable tag set so imports feel organized immediately. */
export function inferBookmarkTags(input: {
	description?: string;
	folder?: string;
	title: string;
	url: string;
}): string[] {
	const domain = domainForUrl(input.url);
	const haystack =
		`${input.title} ${input.description ?? ""} ${input.folder ?? ""} ${domain}`.toLowerCase();
	const tags = new Set<string>();

	for (const rule of TOPIC_RULES) {
		if (rule.needles.some((needle) => haystack.includes(needle))) {
			tags.add(rule.tag);
		}
	}

	if (input.folder?.trim()) {
		tags.add(`folder:${slug(input.folder)}`);
	}
	if (domain !== "unknown source") {
		tags.add(domain);
	}
	if (tags.size === 0) {
		tags.add("uncategorized");
	}
	return [...tags].slice(0, 6);
}

export function collectionLabel(tag: string): string {
	return tag.startsWith("folder:")
		? tag.slice("folder:".length).replace(/-/g, " ")
		: tag;
}
