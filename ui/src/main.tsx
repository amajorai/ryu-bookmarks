import {
	markCompanionAppRoot,
	subscribeCompanionTheme,
} from "@ryu/app-host/companion-theme";
import { RyuAppShell } from "@ryu/blocks/companion/app-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Bookmarks } from "./App.tsx";
import "./tailwind.css";
import "./bookmarks.css";

subscribeCompanionTheme();
const container = document.getElementById("ryu-plugin-root");
if (container) {
	markCompanionAppRoot(container);
	createRoot(container).render(
		<StrictMode>
			<RyuAppShell>
				<Bookmarks />
			</RyuAppShell>
		</StrictMode>
	);
}
