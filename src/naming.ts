import { App, TFolder } from "obsidian";

// Windows-illegal filename characters, per the Python sanitize() reference.
const ILLEGAL = /[<>:"/\\|?*]/g;

/** Turns a note name into a safe filename prefix (mirrors sanitize() in the Python scripts). */
export function sanitizeBaseName(name: string): string {
	const cleaned = name.replace(ILLEGAL, "").trim().replace(/\s+/g, "_");
	return cleaned || "attachment";
}

export function parentFolder(path: string): string {
	const i = path.lastIndexOf("/");
	return i >= 0 ? path.slice(0, i) : "";
}

/** Creates the folder if it does not exist yet. Safe to call concurrently. */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	if (!folderPath) return;
	if (app.vault.getAbstractFileByPath(folderPath)) return;
	try {
		await app.vault.createFolder(folderPath);
	} catch {
		// Already created by a concurrent call - ignore.
	}
}

/**
 * Generates collision-free "<note>_<index>.<ext>" paths for a batch of attachments.
 *
 * The index starts at MAX(existing index) + 1 - NOT count + 1 - so that manually
 * deleting an attachment from the middle (leaving a gap like _1, _3) never produces
 * a name that collides with an existing file. Before every path is handed out it is
 * re-checked against the vault and bumped until free (final guard against races,
 * mixed extensions, or a stale cache). Source of truth is the files on disk, not the
 * note text, so link/file desync cannot cause a collision.
 */
export class AttachmentNamer {
	private readonly base: string;
	private readonly folder: string;
	private counter: number;

	private constructor(base: string, folder: string, startIndex: number) {
		this.base = base;
		this.folder = folder;
		this.counter = startIndex;
	}

	static async create(
		app: App,
		notePath: string,
		noteBaseName: string,
	): Promise<AttachmentNamer> {
		const base = sanitizeBaseName(noteBaseName);
		const folder = await resolveFolder(app, notePath);
		const max = maxExistingIndex(app, folder, base);
		return new AttachmentNamer(base, folder, max + 1);
	}

	/** Returns a vault path guaranteed not to collide with an existing file. */
	next(app: App, ext: string): string {
		let candidate = this.counter;
		let path = this.build(candidate, ext);
		while (app.vault.getAbstractFileByPath(path)) {
			candidate++;
			path = this.build(candidate, ext);
		}
		this.counter = candidate + 1;
		return path;
	}

	private build(index: number, ext: string): string {
		const suffix = ext ? `.${ext}` : "";
		const file = `${this.base}_${index}${suffix}`;
		return this.folder ? `${this.folder}/${file}` : file;
	}
}

/** Asks Obsidian where an attachment for this note would go, and takes the folder. */
async function resolveFolder(app: App, notePath: string): Promise<string> {
	const probe = await app.fileManager.getAvailablePathForAttachment("__probe__.tmp", notePath);
	return parentFolder(probe);
}

/** Highest N among files matching "<base>_<N>.<ext>" in the target folder (0 if none). */
function maxExistingIndex(app: App, folder: string, base: string): number {
	const dir = folder ? app.vault.getAbstractFileByPath(folder) : app.vault.getRoot();
	if (!(dir instanceof TFolder)) return 0;

	const pattern = new RegExp(`^${escapeRegExp(base)}_(\\d+)\\.[^.]+$`);
	let max = 0;
	for (const child of dir.children) {
		const m = child.name.match(pattern);
		if (m) {
			const n = parseInt(m[1], 10);
			if (n > max) max = n;
		}
	}
	return max;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
