import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import styles from "./bookmarks.module.css";

export function SemanticSearchBanner({ onClear }: { onClear: () => void }) {
	return (
		<div className={styles["search-banner"]}>
			<span className={styles["search-spark"]}>
				<HugeiconsIcon icon={SparklesIcon} />
			</span>
			<span>Ryu found the closest ideas in your library.</span>
			<Button
				className="ml-auto"
				onClick={onClear}
				size="xs"
				type="button"
				variant="link"
			>
				Show everything
			</Button>
		</div>
	);
}
