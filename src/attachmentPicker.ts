/**
 * Opens the OS file picker via a hidden <input type="file" multiple>.
 * Works identically on desktop (Electron) and mobile (Capacitor WebView) — no Node APIs.
 * Resolves to an empty array if the user cancels.
 */

// Standard 'cancel' event on <input type="file"> (Chromium 113+, WKWebView/Safari 16.4+).
// When available it is the ONLY reliable cancel signal; the legacy focus heuristic below
// can race a slow 'change' event and silently drop a real selection, so we skip it there.
const HAS_CANCEL_EVENT =
	typeof HTMLInputElement !== "undefined" && "oncancel" in HTMLInputElement.prototype;

export function pickFiles(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.style.display = "none";
		document.body.appendChild(input);

		let settled = false;
		// Set by whichever cancel-detection strategy is chosen below.
		let teardown = () => {};
		const finish = (files: File[]) => {
			if (settled) return;
			settled = true;
			teardown();
			input.remove();
			resolve(files);
		};

		input.addEventListener("change", () => {
			finish(input.files ? Array.from(input.files) : []);
		});

		if (HAS_CANCEL_EVENT) {
			input.addEventListener("cancel", () => finish([]));
		} else {
			// Legacy fallback: 'change' never fires on cancel. When the window regains
			// focus without a selection, treat it as a cancel — but only after a grace
			// period. On Android 'focus' often arrives BEFORE 'change' (the picker Activity
			// result is delivered asynchronously), so a short window would resolve to []
			// and silently drop a real selection. Keep this comfortably long; a cancel
			// just feels slower.
			const CANCEL_GRACE_MS = 2000;
			const onFocus = () => {
				window.setTimeout(() => {
					if (!settled && (!input.files || input.files.length === 0)) {
						finish([]);
					}
				}, CANCEL_GRACE_MS);
			};
			window.addEventListener("focus", onFocus);
			teardown = () => window.removeEventListener("focus", onFocus);
		}

		input.click();
	});
}
