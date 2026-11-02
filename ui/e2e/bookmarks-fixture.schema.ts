import { z } from "zod";
import { spaceDocumentSchema } from "../src/schemas.ts";

export const bookmarksFixtureStateSchema = z
	.object({
		bookmarks: z.array(
			spaceDocumentSchema.extend({
				kind: z.literal("bookmark"),
				updated_at: z.number(),
			})
		),
		searchIds: z.array(z.string()).nullable(),
	})
	.catchall(z.json().optional());
