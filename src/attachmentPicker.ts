/**
 * Opens the OS file picker via a hidden <input type="file" multiple>.
 * Works identically on desktop (Electron) and mobile (Capacitor WebView) — no Node APIs.
 * Resolves to an empty array if the user cancels.
 */
export function pickFiles(accept?: string): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		if (accept) input.accept = accept;
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
		// without a selection, treat it as a cancel after a short grace period.
		const onFocus = () => {
			window.setTimeout(() => {
				if (!settled && (!input.files || input.files.length === 0)) {
					finish([]);
				}
			}, 500);
		};
		window.addEventListener("focus", onFocus);

		input.click();
	});
}
