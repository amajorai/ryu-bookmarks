import {
	ArrowUpRight01Icon,
	Delete02Icon,
	FavouriteIcon,
	Folder01Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@ryu/ui/components/tooltip.tsx";
import { collectionLabel } from "./organize.ts";
import { type Bookmark, domainForUrl } from "./types.ts";

export interface BookmarkCardProps {
	bookmark: Bookmark;
	className?: string;
	compact?: boolean;
	onDelete: (bookmark: Bookmark) => void;
	onEdit: (bookmark: Bookmark) => void;
	onFavorite: (bookmark: Bookmark) => void;
	onOpen: (bookmark: Bookmark) => void;
}

export function formatSavedAt(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	}
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function faviconFor(bookmark: Bookmark): string {
	return domainForUrl(bookmark.url).slice(0, 1).toUpperCase();
}

export function BookmarkCard({
	bookmark,
	className,
	compact = false,
	onDelete,
	onEdit,
	onFavorite,
	onOpen,
}: BookmarkCardProps) {
	return (
		<article
			className={["bookmark-card", compact ? "is-compact" : "", className]
				.filter(Boolean)
				.join(" ")}
		>
			<div className="card-topline">
				<div aria-hidden="true" className="source-mark">
					{faviconFor(bookmark)}
				</div>
				<div className="source-line">
					<span className="source-domain">{domainForUrl(bookmark.url)}</span>
					<span className="saved-date">
						{formatSavedAt(bookmark.updatedAt)}
					</span>
				</div>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								aria-label={
									bookmark.favorite ? "Remove favorite" : "Add favorite"
								}
								className={
									bookmark.favorite ? "star-button is-favorite" : "star-button"
								}
								onClick={() => onFavorite(bookmark)}
								size="icon-sm"
								type="button"
								variant="ghost"
							>
								<HugeiconsIcon
									fill={bookmark.favorite ? "currentColor" : "none"}
									icon={FavouriteIcon}
								/>
							</Button>
						}
					/>
					<TooltipContent>
						{bookmark.favorite ? "Remove favorite" : "Add favorite"}
					</TooltipContent>
				</Tooltip>
			</div>
			<Button
				className="card-title-button"
				onClick={() => onOpen(bookmark)}
				type="button"
				variant="ghost"
			>
				<h3>{bookmark.title}</h3>
				<HugeiconsIcon className="title-arrow" icon={ArrowUpRight01Icon} />
			</Button>
			<p className="bookmark-description">
				{bookmark.description ||
					"Saved without a note — search will still find it by title, URL, and domain."}
			</p>
			<div className="card-footer">
				<div className="tag-list">
					{bookmark.tags.slice(0, 3).map((tag) => (
						<Badge className="bookmark-tag" key={tag} variant="secondary">
							{collectionLabel(tag)}
						</Badge>
					))}
					{bookmark.folder ? (
						<span className="folder-label">
							<HugeiconsIcon icon={Folder01Icon} />
							{bookmark.folder.split(" / ").at(-1)}
						</span>
					) : null}
				</div>
				<div className="card-actions">
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label={`Edit ${bookmark.title}`}
									className="card-action edit-button"
									onClick={() => onEdit(bookmark)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<HugeiconsIcon icon={PencilEdit01Icon} />
								</Button>
							}
						/>
						<TooltipContent>Edit bookmark</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label={`Delete ${bookmark.title}`}
									className="card-action delete-button"
									onClick={() => onDelete(bookmark)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<HugeiconsIcon icon={Delete02Icon} />
								</Button>
							}
						/>
						<TooltipContent>Delete bookmark</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</article>
	);
}
