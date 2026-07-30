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
 * Builds a link to the attachment, honouring the user's link style (wikilink vs.
 * markdown) via generateMarkdownLink. Embeddable files get a leading "!".
 */
export function buildLink(app: App, file: TFile, sourcePath: string): string {
	const link = app.fileManager.generateMarkdownLink(file, sourcePath);
	const prefix = EMBEDDABLE.has(file.extension.toLowerCase()) ? "!" : "";
	return `${prefix}${link}`;
}

/**
 * Inserts all links at the cursor in one edit — a single undo step, and the
 * delimiter lands only BETWEEN links (no stray trailing whitespace/newline).
 */
export function insertLinks(editor: Editor, links: string[], delimiter: string): void {
	if (links.length === 0) return;
	editor.replaceSelection(links.join(delimiter));
}
