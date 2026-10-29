import { z } from "zod";
import type { Bookmark } from "./types.ts";

const extra = z.json().optional();
const bookmarkProjection = z
	.object({
		createdAt: z.number(),
		description: z.string(),
		favorite: z.boolean(),
		folder: z.string(),
		id: z.string(),
		tags: z.array(z.string()),
		title: z.string(),
		updatedAt: z.number(),
		url: z.string(),
	})
	.catchall(extra) satisfies z.ZodType<Bookmark>;
export const bookmarkSchema = z.custom<Bookmark>(
	(value) => bookmarkProjection.safeParse(value).success
);
export const spaceDocumentSummarySchema = z
	.object({ id: z.string(), title: z.string(), updated_at: z.number() })
	.catchall(extra);
export const spaceDocumentSummariesSchema = z
	.array(spaceDocumentSummarySchema)
	.nullish();
export const spaceDocumentSchema = z
	.object({
		id: z.string(),
		kind: z.string(),
		source: z.string(),
		title: z.string(),
	})
	.catchall(extra);
export const spaceDocumentReplySchema = spaceDocumentSchema.nullable();
export const spaceMatchSchema = z
	.object({
		chunk_id: z.string().optional(),
		content: z.string(),
		distance: z.number(),
		document_id: z.string(),
	})
	.catchall(extra);
export const spaceSearchSchema = z.array(spaceMatchSchema);
export const storedSpaceIdSchema = z.string();
export const createdSpaceIdSchema = z.string().min(1);
export interface SpaceDocumentSummary {
	id: string;
	title: string;
	updated_at: number;
}
export interface SpaceDocument {
	id: string;
	kind: string;
	source: string;
	title: string;
}
export interface SpaceMatch {
	chunk_id?: string;
	content: string;
	distance: number;
	document_id: string;
}
export function bookmarkReadbackSchema<S extends z.ZodType>(schema: S) {
	return z.custom<z.output<S>>((value) => schema.safeParse(value).success);
}
