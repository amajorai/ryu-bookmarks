import {
	Add01Icon,
	Bookmark01Icon,
	Link01Icon,
	Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@ryu/ui/components/empty.tsx";
import styles from "./bookmarks.module.css";

export function EmptyState({
	onAdd,
	onImport,
}: {
	onAdd: () => void;
	onImport: () => void;
}) {
	return (
		<Empty className="min-h-64">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<HugeiconsIcon icon={Bookmark01Icon} />
				</EmptyMedia>
				<EmptyTitle>No bookmarks yet</EmptyTitle>
				<EmptyDescription>
					Add a bookmark or import an HTML export to start your library.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row flex-wrap justify-center">
				<Button onClick={onAdd} type="button">
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

export function FilteredEmptyState({ onReset }: { onReset: () => void }) {
	return (
		<div className={styles["filtered-empty"]}>
			<Empty>
				<EmptyMedia variant="default">
					<HugeiconsIcon icon={Link01Icon} />
				</EmptyMedia>
				<EmptyHeader>
					<EmptyTitle>Nothing in this view yet.</EmptyTitle>
					<EmptyDescription>
						<span>Try another collection or clear the search.</span>
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						className="mt-2.5"
						onClick={onReset}
						size="sm"
						type="button"
						variant="outline"
					>
						Reset view
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
