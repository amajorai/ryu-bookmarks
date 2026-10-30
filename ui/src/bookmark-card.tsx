import {
	ArrowUpRight01Icon,
	Delete02Icon,
	FavouriteIcon,
	Folder01Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@ryu/ui/components/tooltip.tsx";
import { formatDate, formatTime } from "@ryu/ui/lib/timezone.ts";
import { useId, useState } from "react";
import styles from "./bookmarks.module.css";
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
	const date = formatDate(timestamp, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const today = formatDate(Date.now(), {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	if (date === today) {
		return `Today, ${formatTime(timestamp, { hour: "numeric", minute: "2-digit" })}`;
	}
	return formatDate(timestamp, { month: "short", day: "numeric" });
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
	const tl = useLiteralMessages();
	const [openTooltip, setOpenTooltip] = useState<
		"favorite" | "edit" | "delete" | null
	>(null);
	const favoriteTooltipId = useId();
	const editTooltipId = useId();
	const deleteTooltipId = useId();
	const tooltipTriggerEvents = (name: "favorite" | "edit" | "delete") => ({
		onBlurCapture: (event: React.FocusEvent<HTMLSpanElement>) => {
			const relatedNode =
				event.relatedTarget instanceof Node ? event.relatedTarget : null;
			if (!event.currentTarget.contains(relatedNode)) {
				setOpenTooltip((current) => (current === name ? null : current));
			}
		},
		onFocusCapture: () => setOpenTooltip(name),
		onMouseEnter: () => setOpenTooltip(name),
		onMouseLeave: () =>
			setOpenTooltip((current) => (current === name ? null : current)),
	});
	return (
		<article
			className={[
				styles["bookmark-card"],
				compact ? styles["is-compact"] : "",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			<div className={styles["card-topline"]}>
				<div aria-hidden="true" className={styles["source-mark"]}>
					{faviconFor(bookmark)}
				</div>
				<div className={styles["source-line"]}>
					<span className={styles["source-domain"]}>
						{domainForUrl(bookmark.url)}
					</span>
					<span className={styles["saved-date"]}>
						{formatSavedAt(bookmark.updatedAt)}
					</span>
				</div>
				<Tooltip
					onOpenChange={(open) =>
						setOpenTooltip((current) =>
							open ? "favorite" : current === "favorite" ? null : current
						)
					}
					open={openTooltip === "favorite"}
				>
					<span
						className="relative inline-flex"
						{...tooltipTriggerEvents("favorite")}
					>
						<TooltipTrigger
							render={
								<Button
									aria-describedby={
										openTooltip === "favorite" ? favoriteTooltipId : undefined
									}
									aria-label={
										bookmark.favorite ? "Remove favorite" : "Add favorite"
									}
									onClick={() => onFavorite(bookmark)}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<HugeiconsIcon
										className={bookmark.favorite ? "text-primary" : undefined}
										fill={bookmark.favorite ? "currentColor" : "none"}
										icon={FavouriteIcon}
									/>
								</Button>
							}
						/>
						<TooltipContent id={favoriteTooltipId} role="tooltip">
							{bookmark.favorite ? "Remove favorite" : "Add favorite"}
						</TooltipContent>
					</span>
				</Tooltip>
			</div>
			<Button
				className="group my-3 w-full justify-start whitespace-normal text-left"
				onClick={() => onOpen(bookmark)}
				size="sm"
				type="button"
				variant="ghost"
			>
				<span className="flex-1 font-heading font-normal text-lg leading-tight tracking-tight">
					{bookmark.title}
				</span>
				<HugeiconsIcon
					aria-hidden="true"
					className="shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
					icon={ArrowUpRight01Icon}
				/>
			</Button>
			<p className={styles["bookmark-description"]}>
				{bookmark.description ||
					"Saved without a note — search will still find it by title, URL, and domain."}
			</p>
			<div className={styles["card-footer"]}>
				<div className={styles["tag-list"]}>
					{bookmark.tags.slice(0, 3).map((tag) => (
						<Badge key={tag} variant="secondary">
							{collectionLabel(tag)}
						</Badge>
					))}
					{bookmark.folder ? (
						<span className={styles["folder-label"]}>
							<HugeiconsIcon icon={Folder01Icon} />
							{bookmark.folder.split(" / ").at(-1)}
						</span>
					) : null}
				</div>
				<div className={styles["card-actions"]}>
					<Tooltip
						onOpenChange={(open) =>
							setOpenTooltip((current) =>
								open ? "edit" : current === "edit" ? null : current
							)
						}
						open={openTooltip === "edit"}
					>
						<span
							className="relative inline-flex"
							{...tooltipTriggerEvents("edit")}
						>
							<TooltipTrigger
								render={
									<Button
										aria-describedby={
											openTooltip === "edit" ? editTooltipId : undefined
										}
										aria-label={tl("Edit {title}", { title: bookmark.title })}
										className="group"
										onClick={() => onEdit(bookmark)}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<HugeiconsIcon
											className="text-muted-foreground transition-colors group-hover:text-primary"
											icon={PencilEdit01Icon}
										/>
									</Button>
								}
							/>
							<TooltipContent id={editTooltipId} role="tooltip">
								Edit bookmark
							</TooltipContent>
						</span>
					</Tooltip>
					<Tooltip
						onOpenChange={(open) =>
							setOpenTooltip((current) =>
								open ? "delete" : current === "delete" ? null : current
							)
						}
						open={openTooltip === "delete"}
					>
						<span
							className="relative inline-flex"
							{...tooltipTriggerEvents("delete")}
						>
							<TooltipTrigger
								render={
									<Button
										aria-describedby={
											openTooltip === "delete" ? deleteTooltipId : undefined
										}
										aria-label={tl("Delete {title}", { title: bookmark.title })}
										className="group"
										onClick={() => onDelete(bookmark)}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<HugeiconsIcon
											className="text-muted-foreground transition-colors group-hover:text-status-destructive"
											icon={Delete02Icon}
										/>
									</Button>
								}
							/>
							<TooltipContent id={deleteTooltipId} role="tooltip">
								Delete bookmark
							</TooltipContent>
						</span>
					</Tooltip>
				</div>
			</div>
		</article>
	);
}
