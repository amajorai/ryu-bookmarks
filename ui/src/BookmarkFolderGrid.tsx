import { ProjectFolder } from "@ryu/ui/components/project-folder.tsx";
import type { ReactElement } from "react";
import { BookmarkCard, faviconFor } from "./bookmark-card.tsx";
import type { BookmarkCollection } from "./bookmark-folders.ts";
import styles from "./bookmarks.module.css";
import { type Bookmark, domainForUrl } from "./types.ts";

export interface BookmarkFolderGridProps {
	collections: BookmarkCollection[];
	onDelete: (bookmark: Bookmark) => void;
	onEdit: (bookmark: Bookmark) => void;
	onFavorite: (bookmark: Bookmark) => void;
	onOpen: (bookmark: Bookmark) => void;
}

function BookmarkTinyPreview({ bookmark }: { bookmark: Bookmark }) {
	const snippet = bookmark.description || domainForUrl(bookmark.url);

	return (
		<article className={styles["bookmark-tiny-preview"]}>
			<div aria-hidden="true" className={styles["bookmark-tiny-mark"]}>
				{faviconFor(bookmark)}
			</div>
			<div className={styles["bookmark-tiny-copy"]}>
				<strong>{bookmark.title}</strong>
				<span>{snippet}</span>
			</div>
		</article>
	);
}

export function BookmarkFolderGrid({
	collections,
	onDelete,
	onEdit,
	onFavorite,
	onOpen,
}: BookmarkFolderGridProps): ReactElement {
	return (
		<div
			aria-label="Bookmark folders"
			className={styles["bookmark-folder-grid"]}
			role="group"
		>
			{collections.map((collection) => (
				<ProjectFolder
					count={collection.bookmarks.length}
					itemLabel="bookmark"
					key={collection.key}
					previews={collection.bookmarks.slice(0, 5).map((bookmark) => ({
						content: (expanded: boolean) =>
							expanded ? (
								<BookmarkCard
									bookmark={bookmark}
									compact
									onDelete={onDelete}
									onEdit={onEdit}
									onFavorite={onFavorite}
									onOpen={onOpen}
								/>
							) : (
								<BookmarkTinyPreview bookmark={bookmark} />
							),
						id: bookmark.id,
						label: bookmark.title,
					}))}
					title={collection.label}
				/>
			))}
		</div>
	);
}
