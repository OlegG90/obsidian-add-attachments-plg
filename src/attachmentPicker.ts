/**
 * Opens the OS file picker via a hidden <input type="file" multiple>.
 * Works identically on desktop (Electron) and mobile (Capacitor WebView) — no Node APIs.
 * Resolves to an empty array if the user cancels.
 */

/**
 * Both cancel-detection strategies are armed at once, because neither covers every
 * runtime and event support cannot be feature-detected:
 *
 *   - 'cancel' (Chromium 113+ / WKWebView 16.4+) is exact and instant, but absent on
 *     WebViews Obsidian still supports: Android 5.1–6 is capped at WebView ~106 (Chrome
 *     M106 was the last release for Android 6), and iOS 16.0–16.3 predates 16.4.
 *   - the focus heuristic works everywhere but only guesses.
 *
 * `finish()` is idempotent, so whichever signal arrives first wins and the other becomes
 * a no-op — no feature test required. Note that `"oncancel" in HTMLInputElement.prototype`
 * does NOT work as one: `oncancel` is a global event handler living on
 * HTMLElement.prototype since the <dialog> era, so it is present a decade before file
 * inputs started firing 'cancel'.
 */
const CANCEL_BACKSTOP_MS = 10000;

export function pickFiles(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		// Hidden via a class, not an inline style (Obsidian plugin guideline).
		input.classList.add("add-attachment-file-input");
		document.body.appendChild(input);

		// One teardown path for every listener below.
		const listeners = new AbortController();
		const { signal } = listeners;

		let settled = false;
		const finish = (files: File[]) => {
			if (settled) return;
			settled = true;
			listeners.abort();
			input.remove();
			resolve(files);
		};

		input.addEventListener(
			"change",
			() => finish(input.files ? Array.from(input.files) : []),
			{ signal },
		);

		// Exact signal wherever it exists.
		input.addEventListener("cancel", () => finish([]), { signal });

		// Backstop for runtimes without 'cancel': focus returning with no files means the
		// dialog closed without a selection. Deliberately slow — on those old WebViews
		// 'change' can lag 'focus', and dropping a real selection is far worse than a
		// cancel feeling unhurried. Where 'cancel' exists it always wins, so this timer
		// is never observed.
		window.addEventListener(
			"focus",
			() => {
				window.setTimeout(() => {
					if (!input.files || input.files.length === 0) finish([]);
				}, CANCEL_BACKSTOP_MS);
			},
			{ signal },
		);

		input.click();
	});
}
