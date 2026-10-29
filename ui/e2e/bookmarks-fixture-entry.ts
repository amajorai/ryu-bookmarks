import { installBookmarksHost } from "./bookmarks-fixture.ts";

declare global {
	interface Window {
		__installBookmarksHost: typeof installBookmarksHost;
	}
}
window.__installBookmarksHost = installBookmarksHost;
