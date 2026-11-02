import { BookmarkCheck01Icon } from "@hugeicons/core-free-icons";
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
import { Input } from "@ryu/ui/components/input.tsx";
import { Label } from "@ryu/ui/components/label.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { type SubmitEvent, useState } from "react";
import styles from "./bookmarks.module.css";
import type { Bookmark, BookmarkDraft } from "./types.ts";

export function AddBookmarkModal({
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

	const submit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		void save();
	};

	return (
		<Dialog
			disablePointerDismissal
			onOpenChange={(open) => !open && onClose()}
			open
		>
			<DialogContent className="sm:max-w-[460px]">
				<DialogHeader>
					<DialogTitle>
						{initialBookmark ? "Refine a useful link" : "Keep a useful link"}
					</DialogTitle>
					<DialogDescription>
						Ryu will keep the source, your note, and the inferred context
						together.
					</DialogDescription>
				</DialogHeader>
				<form className={styles["bookmark-form"]} onSubmit={submit}>
					<div className={styles["bookmark-field"]}>
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
					<div className={styles["bookmark-field"]}>
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
					<div className={styles["bookmark-field"]}>
						<Label htmlFor="bookmark-description">
							Note <span className={styles.optional}>optional</span>
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
					<div className={styles["bookmark-field"]}>
						<Label htmlFor="bookmark-folder">
							Folder <span className={styles.optional}>optional</span>
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
						<p
							className={[styles["form-error"], "text-status-destructive"].join(
								" "
							)}
							role="alert"
						>
							{formError}
						</p>
					) : null}
					<DialogFooter>
						<Button onClick={onClose} type="button" variant="ghost">
							Cancel
						</Button>
						<Button disabled={busy} type="submit">
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
