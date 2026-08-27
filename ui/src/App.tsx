import {
	Add01Icon,
	ArrowRight01Icon,
	Bookmark01Icon,
	BookmarkCheck01Icon,
	Cancel01Icon,
	FavouriteIcon,
	GridIcon,
	InboxIcon,
	Link01Icon,
	Search01Icon,
	SparklesIcon,
	Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ryu/ui/components/dialog.tsx";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@ryu/ui/components/empty.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { Label } from "@ryu/ui/components/label.tsx";
import { Spinner } from "@ryu/ui/components/spinner.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { TooltipProvider } from "@ryu/ui/components/tooltip.tsx";
import {
	type ChangeEvent,
	type CSSProperties,
	type FormEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { BookmarkFolderGrid } from "./BookmarkFolderGrid.tsx";
import {
	groupBookmarks,
	syntheticBookmarkCollection,
} from "./bookmark-folders.ts";
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

type Filter = "all" | "favorites" | "recent";

interface TopicCount {
	count: number;
	tag: string;
}

function sortBookmarks(bookmarks: Bookmark[]): Bookmark[] {
	return [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt);
}

function AddBookmarkModal({
	busy,
	initialBookmark,
	onClose,
	onSave,
}: {
	busy: boolean;
	initialBookmark: Bookmark | null;
	onClose: () => void;
	onSave: (draft: BookmarkDraft) => Promise<void>;
}) {
	const [draft, setDraft] = useState<BookmarkDraft>(() => ({
		description: initialBookmark?.description ?? "",
		folder: initialBookmark?.folder ?? "",
		title: initialBookmark?.title ?? "",
		url: initialBookmark?.url ?? "",
	}));
	const [formError, setFormError] = useState<string | null>(null);

	const save = async (): Promise<void> => {
		setFormError(null);
		try {
			const parsed = new URL(draft.url.trim());
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				throw new Error("Use an http or https URL.");
			}
			await onSave({
				...draft,
				title: draft.title.trim() || parsed.hostname.replace(/^www\./, ""),
				url: parsed.toString(),
			});
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "Could not add bookmark"
			);
		}
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void save();
	};

	return (
		<Dialog
			disablePointerDismissal
			onOpenChange={(open) => !open && onClose()}
			open
		>
			<DialogContent className="bookmark-dialog sm:max-w-[460px]">
				<DialogHeader>
					<span className="eyebrow">
						{initialBookmark ? "EDIT MEMORY" : "NEW MEMORY"}
					</span>
					<DialogTitle className="bookmark-dialog-title">
						{initialBookmark ? "Refine a useful link" : "Keep a useful link"}
					</DialogTitle>
					<DialogDescription>
						Ryu will keep the source, your note, and the inferred context
						together.
					</DialogDescription>
				</DialogHeader>
				<form className="bookmark-form" onSubmit={submit}>
					<div className="bookmark-field">
						<Label htmlFor="bookmark-url">URL</Label>
						<Input
							autoFocus
							id="bookmark-url"
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									url: event.target.value,
								}))
							}
							placeholder="https://…"
							required
							type="url"
							value={draft.url}
						/>
					</div>
					<div className="bookmark-field">
						<Label htmlFor="bookmark-title">Name</Label>
						<Input
							id="bookmark-title"
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							placeholder="A title you will recognize later"
							type="text"
							value={draft.title}
						/>
					</div>
					<div className="bookmark-field">
						<Label htmlFor="bookmark-description">
							Note <span className="optional">optional</span>
						</Label>
						<Textarea
							id="bookmark-description"
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									description: event.target.value,
								}))
							}
							placeholder="Why is this worth keeping?"
							rows={3}
							value={draft.description ?? ""}
						/>
					</div>
					<div className="bookmark-field">
						<Label htmlFor="bookmark-folder">
							Folder <span className="optional">optional</span>
						</Label>
						<Input
							id="bookmark-folder"
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									folder: event.target.value,
								}))
							}
							placeholder="Reading / Later"
							type="text"
							value={draft.folder ?? ""}
						/>
					</div>
					{formError ? (
						<p className="form-error text-destructive" role="alert">
							{formError}
						</p>
					) : null}
					<DialogFooter className="modal-actions">
						<Button onClick={onClose} type="button" variant="ghost">
							Cancel
						</Button>
						<Button
							className="bookmark-primary"
							disabled={busy}
							onClick={(event) => {
								event.preventDefault();
								void save();
							}}
							type="button"
						>
							<HugeiconsIcon icon={BookmarkCheck01Icon} />
							{busy
								? initialBookmark
									? "Updating…"
									: "Saving…"
								: initialBookmark
									? "Update bookmark"
									: "Save bookmark"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function EmptyState({
	onAdd,
	onImport,
}: {
	onAdd: () => void;
	onImport: () => void;
}) {
	return (
		<Empty className="empty-state">
			<EmptyHeader>
				<EmptyMedia className="empty-orbit" variant="icon">
					<HugeiconsIcon icon={Bookmark01Icon} />
					<span className="orbit-dot" />
					<span className="orbit-dot orbit-dot-two" />
				</EmptyMedia>
				<span className="eyebrow">A CLEAN SLATE</span>
				<EmptyTitle className="empty-title">
					Save the links you want to remember.
				</EmptyTitle>
				<EmptyDescription className="empty-copy">
					Import your browser export, or start with one useful page. Ryu will
					infer collections and make the whole library semantically searchable.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="empty-actions">
				<Button className="bookmark-primary" onClick={onAdd} type="button">
					<HugeiconsIcon icon={Add01Icon} />
					Add a bookmark
				</Button>
				<Button onClick={onImport} type="button" variant="outline">
					<HugeiconsIcon icon={Upload01Icon} />
					Import HTML
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export function Bookmarks() {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [spaceId, setSpaceId] = useState<string | null>(null);
	const [activeFilter, setActiveFilter] = useState<Filter>("all");
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

	// The promise ref makes the one-shot load idempotent under React StrictMode.
	// biome-ignore lint/correctness/useExhaustiveDependencies: library bootstrap is intentionally one-shot.
	useEffect(() => {
		if (!loadPromise.current) {
			loadPromise.current = (async () => {
				try {
					await reload();
				} catch (cause) {
					setError(
						cause instanceof Error ? cause.message : "Could not load Bookmarks"
					);
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

	const runSearch = async (event: FormEvent<HTMLFormElement>) => {
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
		? `Semantic matches for “${semanticQuery}”`
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
			<div className="bookmarks-app">
				<aside className="sidebar">
					<div className="brand-lockup">
						<div className="brand-mark">B</div>
						<div>
							<span className="brand-name">Bookmarks</span>
							<span className="brand-caption">Ryu library</span>
						</div>
					</div>

					<div className="sidebar-section">
						<span className="sidebar-label">Library</span>
						<Button
							className={
								activeFilter === "all" && !activeTag
									? "sidebar-link is-active"
									: "sidebar-link"
							}
							onClick={() => {
								setActiveFilter("all");
								setActiveTag(null);
							}}
							type="button"
							variant="ghost"
						>
							<HugeiconsIcon icon={GridIcon} />
							<span>All bookmarks</span>
							<span className="sidebar-count">{bookmarks.length}</span>
						</Button>
						<Button
							className={
								activeFilter === "favorites"
									? "sidebar-link is-active"
									: "sidebar-link"
							}
							onClick={() => {
								setActiveFilter("favorites");
								setActiveTag(null);
							}}
							type="button"
							variant="ghost"
						>
							<HugeiconsIcon icon={FavouriteIcon} />
							<span>Favorites</span>
							<span className="sidebar-count">
								{bookmarks.filter((item) => item.favorite).length}
							</span>
						</Button>
						<Button
							className={
								activeFilter === "recent"
									? "sidebar-link is-active"
									: "sidebar-link"
							}
							onClick={() => {
								setActiveFilter("recent");
								setActiveTag(null);
							}}
							type="button"
							variant="ghost"
						>
							<HugeiconsIcon icon={InboxIcon} />
							<span>Recently saved</span>
						</Button>
					</div>

					<div className="sidebar-section collections-section">
						<div className="sidebar-label-row">
							<span className="sidebar-label">Collections</span>
							<span className="collection-rule" />
						</div>
						{topics.length ? (
							topics.map((topic) => (
								<Button
									className={
										activeTag === topic.tag
											? "sidebar-link collection-link is-active"
											: "sidebar-link collection-link"
									}
									key={topic.tag}
									onClick={() => {
										setActiveFilter("all");
										setActiveTag(topic.tag);
									}}
									type="button"
									variant="ghost"
								>
									<span className="collection-dot" />
									<span>{collectionLabel(topic.tag)}</span>
									<span className="sidebar-count">{topic.count}</span>
								</Button>
							))
						) : (
							<p className="sidebar-empty">Collections appear as you save.</p>
						)}
					</div>

					<div className="sidebar-bottom">
						<div className="index-status">
							<span className="status-pulse" />
							<div>
								<strong>Ryu semantic index</strong>
								<span>Live · Space-backed</span>
							</div>
						</div>
						<div className="sidebar-footer">
							Private by default <span>·</span> yours to shape
						</div>
					</div>
				</aside>

				<main className="main-content">
					<header className="topbar">
						<div className="breadcrumb">
							<span>Library</span>
							<HugeiconsIcon icon={ArrowRight01Icon} />
							<strong>{filterLabel}</strong>
						</div>
						<div className="top-actions">
							{importProgress ? (
								<span className="import-progress">{importProgress}</span>
							) : null}
							<Input
								accept=".html,.htm,text/html"
								className="hidden-input"
								onChange={importFile}
								ref={fileInput}
								type="file"
							/>
							<Button
								className="bookmark-quiet"
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
								className="bookmark-primary"
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

					<section className="hero-row">
						<div>
							<span className="eyebrow">PERSONAL RESEARCH LIBRARY</span>
							<h1>Your bookmarks, with context.</h1>
							<p className="hero-copy">
								A calmer home for the things you meant to come back to.
								<span>
									{" "}
									Ryu learns the shape of your collection as it grows.
								</span>
							</p>
						</div>
						<div className="hero-stat">
							<strong>{bookmarks.length.toString().padStart(2, "0")}</strong>
							<span>
								links
								<br />
								remembered
							</span>
						</div>
					</section>

					<form className="semantic-search" onSubmit={runSearch}>
						<HugeiconsIcon className="search-icon" icon={Search01Icon} />
						<Input
							aria-label="Search bookmarks semantically"
							className="semantic-search-input"
							onChange={(event) => setQueryInput(event.target.value)}
							placeholder="Search by idea, not just a title…"
							value={queryInput}
						/>
						{queryInput ? (
							<Button
								aria-label="Clear search"
								className="clear-search"
								onClick={clearSearch}
								size="icon-sm"
								type="button"
								variant="ghost"
							>
								<HugeiconsIcon icon={Cancel01Icon} />
							</Button>
						) : null}
						<Button
							className="search-submit"
							disabled={busy || !queryInput.trim()}
							size="sm"
							type="submit"
							variant="secondary"
						>
							<HugeiconsIcon icon={SparklesIcon} />
							Semantic search
						</Button>
					</form>

					{semanticQuery ? (
						<div className="search-banner">
							<span className="search-spark">
								<HugeiconsIcon icon={SparklesIcon} />
							</span>
							<span>Ryu found the closest ideas in your library.</span>
							<Button
								className="show-all-button"
								onClick={clearSearch}
								size="xs"
								type="button"
								variant="link"
							>
								Show everything
							</Button>
						</div>
					) : null}

					<section aria-label="Current bookmark topics" className="memory-map">
						<div className="map-heading">
							<span className="eyebrow">MEMORY MAP</span>
							<span className="map-caption">
								Inferred from your saved links
							</span>
						</div>
						<div className="map-track">
							<span className="map-node map-node-start" />
							<span className="map-line" />
							{topics.length ? (
								topics.slice(0, 4).map((topic, index) => (
									<Button
										className={
											activeTag === topic.tag
												? "map-topic is-active"
												: "map-topic"
										}
										key={topic.tag}
										onClick={() => {
											setActiveFilter("all");
											setActiveTag(activeTag === topic.tag ? null : topic.tag);
										}}
										style={{ "--topic-order": index } as CSSProperties}
										type="button"
										variant="ghost"
									>
										<span className="map-topic-dot" />
										{collectionLabel(topic.tag)}
									</Button>
								))
							) : (
								<span className="map-empty">
									Save a few links and your patterns will appear here.
								</span>
							)}
						</div>
					</section>

					<div className="section-heading">
						<div>
							<span className="eyebrow">YOUR LIBRARY</span>
							<h2>{filterLabel}</h2>
						</div>
						<span className="result-count">
							{visibleBookmarks.length} shown
						</span>
					</div>

					{error ? (
						<div className="error-banner" role="alert">
							<span>{error}</span>
							<Button
								className="error-action"
								onClick={() => void reload()}
								size="xs"
								type="button"
								variant="link"
							>
								Try again
							</Button>
						</div>
					) : null}

					{loading ? (
						<div className="loading-state">
							<Spinner className="size-4 text-primary" /> Loading your library…
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
						<Empty className="filtered-empty">
							<EmptyMedia variant="default">
								<HugeiconsIcon icon={Link01Icon} />
							</EmptyMedia>
							<EmptyHeader>
								<EmptyTitle className="filtered-empty-title">
									Nothing in this view yet.
								</EmptyTitle>
								<EmptyDescription>
									<span>Try another collection or clear the search.</span>
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button
									className="reset-view"
									onClick={() => {
										clearSearch();
										setActiveTag(null);
										setActiveFilter("all");
									}}
									size="sm"
									type="button"
									variant="outline"
								>
									Reset view
								</Button>
							</EmptyContent>
						</Empty>
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
