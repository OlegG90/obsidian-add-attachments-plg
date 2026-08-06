/**
 * Opens the OS file picker via a hidden <input type="file" multiple>.
 * Works identically on desktop (Electron) and mobile (Capacitor WebView) — no Node APIs.
 * Resolves to an empty array if the user cancels.
 */
export function pickFiles(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.style.display = "none";
		document.body.appendChild(input);

		let settled = false;
		const finish = (files: File[]) => {
			if (settled) return;
			settled = true;
			window.removeEventListener("focus", onFocus);
			input.remove();
			resolve(files);
		};

		input.addEventListener("change", () => {
			finish(input.files ? Array.from(input.files) : []);
		});

		// The 'change' event never fires on cancel. When the window regains focus
		// without a selection, treat it as a cancel — but only after a grace period.
		// On Android 'focus' often arrives BEFORE 'change' (the picker Activity result is
		// delivered asynchronously), so a short window would resolve to [] and silently
		// drop a real selection. Keep this comfortably long; a cancel just feels slower.
		const CANCEL_GRACE_MS = 2000;
		const onFocus = () => {
			window.setTimeout(() => {
				if (!settled && (!input.files || input.files.length === 0)) {
					finish([]);
				}
			}, CANCEL_GRACE_MS);
		};
		window.addEventListener("focus", onFocus);

		input.click();
	});
}
