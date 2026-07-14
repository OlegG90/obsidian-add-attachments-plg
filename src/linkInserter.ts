import { App, Editor, TFile } from "obsidian";

/** Extensions Obsidian renders as embeds — get a leading "!" so they show inline. */
const EMBEDDABLE = new Set([
	// images
	"png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif",
	// audio
	"mp3", "wav", "m4a", "ogg", "3gp", "flac",
	// video
	"mp4", "webm", "ogv", "mov", "mkv",
	// documents
	"pdf",
]);

/**
 * Inserts a link to the attachment at the cursor, honouring the user's link style
 * (wikilink vs. markdown) via generateMarkdownLink. Embeddable files get "![[...]]".
 */
export function insertLink(app: App, editor: Editor, file: TFile, sourcePath: string): void {
	const link = app.fileManager.generateMarkdownLink(file, sourcePath);
	const prefix = EMBEDDABLE.has(file.extension.toLowerCase()) ? "!" : "";
	editor.replaceSelection(`${prefix}${link}\n`);
}
