import {
	Add01Icon,
	ArrowRight01Icon,
	Cancel01Icon,
	Search01Icon,
	SparklesIcon,
	Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@ryu/ui/components/input-group.tsx";
import { Spinner } from "@ryu/ui/components/spinner.tsx";
import { TooltipProvider } from "@ryu/ui/components/tooltip.tsx";
import {
	type ChangeEvent,
	type SubmitEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AddBookmarkModal } from "./App-add-bookmark-modal.tsx";
import { EmptyState, FilteredEmptyState } from "./App-empty-state.tsx";
import {
	type Filter,
	initialFilter,
	sortBookmarks,
	type TopicCount,
} from "./App-filters.ts";
import { SemanticSearchBanner } from "./App-search-banner.tsx";
import { BookmarkFolderGrid } from "./BookmarkFolderGrid.tsx";
import {
	groupBookmarks,
	syntheticBookmarkCollection,
} from "./bookmark-folders.ts";
import styles from "./bookmarks.module.css";
import {
	createBookmark,
	deleteBookmark,
	ensureBookmarksSpace,
	loadBookmarks,
	openBookmark,
	searchBookmarks,
	updateBookmark,
} from "./bridge.ts";
import { parseBookmarksHtml } from "./html-import.ts";
import { collectionLabel, inferBookmarkTags } from "./organize.ts";
import type { Bookmark, BookmarkDraft } from "./types.ts";

export function Bookmarks() {
	const tl = useLiteralMessages();
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [spaceId, setSpaceId] = useState<string | null>(null);
	const [activeFilter, setActiveFilter] = useState<Filter>(initialFilter);
	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [queryInput, setQueryInput] = useState("");
	const [semanticQuery, setSemanticQuery] = useState("");
	const [searchIds, setSearchIds] = useState<string[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
	const [importing, setImporting] = useState(false);
	const [importProgress, setImportProgress] = useState("");
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const loadPromise = useRef<Promise<void> | null>(null);

	const reload = async (): Promise<void> => {
		setError(null);
		const id = spaceId ?? (await ensureBookmarksSpace());
		setSpaceId(id);
		const next = await loadBookmarks(id);
		setBookmarks(sortBookmarks(next));
	};

	const retryLoad = async (): Promise<void> => {
		try {
			await reload();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not load Bookmarks"
			);
		}
	};

	// The promise ref makes the one-shot load idempotent under React StrictMode.
	useEffect(() => {
		if (!loadPromise.current) {
			loadPromise.current = (async () => {
				try {
					await retryLoad();
				} finally {
					setLoading(false);
				}
			})();
		}
	}, []);

	const topics = useMemo<TopicCount[]>(() => {
		const counts = new Map<string, number>();
		for (const bookmark of bookmarks) {
			for (const tag of bookmark.tags) {
				if (!tag.startsWith("folder:")) {
					counts.set(tag, (counts.get(tag) ?? 0) + 1);
				}
			}
		}
		return [...counts.entries()]
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
			.slice(0, 5);
	}, [bookmarks]);

	const visibleBookmarks = useMemo(() => {
		const base = searchIds
			? bookmarks.filter((bookmark) => searchIds.includes(bookmark.id))
			: bookmarks;
		return base.filter((bookmark) => {
			if (activeFilter === "favorites" && !bookmark.favorite) {
				return false;
			}
			if (
				activeFilter === "recent" &&
				bookmark.updatedAt < Date.now() - 1000 * 60 * 60 * 24 * 30
			) {
				return false;
			}
			return !activeTag || bookmark.tags.includes(activeTag);
		});
	}, [activeFilter, activeTag, bookmarks, searchIds]);

	const saveDraft = async (draft: BookmarkDraft): Promise<void> => {
		if (!spaceId) {
			throw new Error("Bookmarks is still connecting to Ryu");
		}
		setBusy(true);
		try {
			const tags = inferBookmarkTags(draft);
			if (editingBookmark) {
				await updateBookmark({
					...editingBookmark,
					description: draft.description?.trim() ?? "",
					folder: draft.folder?.trim() ?? "",
					tags,
					title: draft.title.trim() || draft.url,
					updatedAt: Date.now(),
					url: draft.url,
				});
			} else {
				await createBookmark(spaceId, draft, tags);
			}
			await reload();
			setModalOpen(false);
			setEditingBookmark(null);
			setError(null);
		} finally {
			setBusy(false);
		}
	};

	const runSearch = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		const query = queryInput.trim();
		if (!query) {
			setSearchIds(null);
			setSemanticQuery("");
			return;
		}
		if (!spaceId) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const matches = await searchBookmarks(spaceId, query);
			setSearchIds([...new Set(matches.map((match) => match.document_id))]);
			setSemanticQuery(query);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Semantic search failed"
			);
		} finally {
			setBusy(false);
		}
	};

	const clearSearch = () => {
		setQueryInput("");
		setSemanticQuery("");
		setSearchIds(null);
	};

	const toggleFavorite = async (bookmark: Bookmark) => {
		const next = {
			...bookmark,
			favorite: !bookmark.favorite,
			updatedAt: Date.now(),
		};
		setBookmarks((current) =>
			current.map((item) => (item.id === next.id ? next : item))
		);
		try {
			await updateBookmark(next);
		} catch (cause) {
			setBookmarks((current) =>
				current.map((item) => (item.id === bookmark.id ? bookmark : item))
			);
			setError(
				cause instanceof Error ? cause.message : "Could not update bookmark"
			);
		}
	};

	const removeBookmark = async (bookmark: Bookmark) => {
		setBookmarks((current) =>
			current.filter((item) => item.id !== bookmark.id)
		);
		try {
			await deleteBookmark(bookmark.id);
		} catch (cause) {
			setBookmarks((current) => sortBookmarks([...current, bookmark]));
			setError(
				cause instanceof Error ? cause.message : "Could not delete bookmark"
			);
		}
	};

	const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!(file && spaceId)) {
			return;
		}
		setImporting(true);
		setError(null);
		try {
			const imported = parseBookmarksHtml(await file.text());
			for (const [index, item] of imported.entries()) {
				setImportProgress(`${index + 1} of ${imported.length}`);
				await createBookmark(
					spaceId,
					item,
					inferBookmarkTags({
						description: item.description,
						folder: item.folder,
						title: item.title,
						url: item.url,
					})
				);
			}
			await reload();
			setImportProgress(
				imported.length ? `${imported.length} imported` : "No links found"
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not import bookmarks"
			);
		} finally {
			setImporting(false);
			window.setTimeout(() => setImportProgress(""), 2400);
		}
	};

	const filterLabel = semanticQuery
		? tl("Semantic matches for “{semanticQuery}”", { semanticQuery })
		: activeTag
			? collectionLabel(activeTag)
			: activeFilter === "favorites"
				? "Favorites"
				: activeFilter === "recent"
					? "Recently saved"
					: "All bookmarks";

	const collections = useMemo(() => {
		const filtered = visibleBookmarks;
		const isAllView = !(semanticQuery || activeTag) && activeFilter === "all";
		return isAllView
			? groupBookmarks(filtered)
			: filtered.length
				? [syntheticBookmarkCollection(filterLabel, filtered)]
				: [];
	}, [activeFilter, activeTag, filterLabel, semanticQuery, visibleBookmarks]);

	return (
		<TooltipProvider delay={350}>
			<div className={styles["bookmarks-app"]}>
				<main className={styles["main-content"]}>
					<header className={styles.topbar}>
						<div className={styles.breadcrumb}>
							<span>Library</span>
							<HugeiconsIcon icon={ArrowRight01Icon} />
							<strong>{filterLabel}</strong>
						</div>
						<div className={styles["top-actions"]}>
							{importProgress ? (
								<span className={styles["import-progress"]}>
									{importProgress}
								</span>
							) : null}
							<Input
								accept=".html,.htm,text/html"
								hidden
								onChange={importFile}
								ref={fileInput}
								type="file"
							/>
							<Button
								disabled={importing}
								onClick={() => fileInput.current?.click()}
								size="sm"
								type="button"
								variant="outline"
							>
								<HugeiconsIcon icon={Upload01Icon} />
								{importing ? "Importing…" : "Import HTML"}
							</Button>
							<Button
								onClick={() => {
									setEditingBookmark(null);
									setModalOpen(true);
								}}
								size="sm"
								type="button"
								variant="default"
							>
								<HugeiconsIcon icon={Add01Icon} />
								Add bookmark
							</Button>
						</div>
					</header>

					<form className={styles["semantic-search"]} onSubmit={runSearch}>
						<InputGroup>
							<InputGroupAddon>
								<HugeiconsIcon aria-hidden="true" icon={Search01Icon} />
							</InputGroupAddon>
							<InputGroupInput
								aria-label="Search bookmarks semantically"
								onChange={(event) => setQueryInput(event.target.value)}
								placeholder="Search bookmarks"
								value={queryInput}
							/>
							{queryInput ? (
								<InputGroupButton
									aria-label="Clear search"
									onClick={clearSearch}
									size="icon-sm"
									variant="ghost"
								>
									<HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
								</InputGroupButton>
							) : null}
							<InputGroupButton
								disabled={busy || !queryInput.trim()}
								size="sm"
								type="submit"
								variant="secondary"
							>
								<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
								Semantic search
							</InputGroupButton>
						</InputGroup>
					</form>

					{semanticQuery ? (
						<SemanticSearchBanner onClear={clearSearch} />
					) : null}

					<section
						aria-label="Current bookmark topics"
						className={styles["memory-map"]}
					>
						<div className={styles["map-heading"]}>
							<span className={styles["map-caption"]}>
								Inferred from your saved links
							</span>
						</div>
						<div className={styles["map-track"]}>
							<span
								className={[styles["map-node"], styles["map-node-start"]].join(
									" "
								)}
							/>
							<span className={styles["map-line"]} />
							{topics.length ? (
								topics.slice(0, 4).map((topic) => (
									<Button
										className="relative z-10"
										data-topic-active={
											activeTag === topic.tag ? "true" : "false"
										}
										key={topic.tag}
										onClick={() => {
											setActiveFilter("all");
											setActiveTag(activeTag === topic.tag ? null : topic.tag);
										}}
										type="button"
										variant={activeTag === topic.tag ? "secondary" : "ghost"}
									>
										<span className={styles["map-topic-dot"]} />
										{collectionLabel(topic.tag)}
									</Button>
								))
							) : (
								<span className={styles["map-empty"]}>
									Save a few links and your patterns will appear here.
								</span>
							)}
						</div>
					</section>

					<div className={styles["section-heading"]}>
						<div>
							<h2>{filterLabel}</h2>
						</div>
						<span className={styles["result-count"]}>
							{tl("{length} shown", {
								length: String(visibleBookmarks.length),
							})}
						</span>
					</div>

					{error ? (
						<div className={styles["error-banner"]} role="alert">
							<span>{error}</span>
							<Button
								onClick={() => void retryLoad()}
								size="xs"
								type="button"
								variant="link"
							>
								Try again
							</Button>
						</div>
					) : null}

					{loading ? (
						<div className={styles["loading-state"]}>
							<Spinner className="size-4" /> Loading your library…
						</div>
					) : visibleBookmarks.length ? (
						<BookmarkFolderGrid
							collections={collections}
							onDelete={(item) => void removeBookmark(item)}
							onEdit={(item) => {
								setEditingBookmark(item);
								setModalOpen(true);
							}}
							onFavorite={(item) => void toggleFavorite(item)}
							onOpen={(item) => openBookmark(item.url)}
						/>
					) : bookmarks.length ? (
						<FilteredEmptyState
							onReset={() => {
								clearSearch();
								setActiveTag(null);
								setActiveFilter("all");
							}}
						/>
					) : (
						<EmptyState
							onAdd={() => {
								setEditingBookmark(null);
								setModalOpen(true);
							}}
							onImport={() => fileInput.current?.click()}
						/>
					)}
				</main>

				{modalOpen ? (
					<AddBookmarkModal
						busy={busy}
						initialBookmark={editingBookmark}
						key={editingBookmark?.id ?? "new"}
						onClose={() => {
							setModalOpen(false);
							setEditingBookmark(null);
						}}
						onSave={saveDraft}
					/>
				) : null}
			</div>
		</TooltipProvider>
	);
}
