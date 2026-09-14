import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import {
	AddAttachmentSettings,
	AddAttachmentSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { pickFiles } from "./attachmentPicker";
import { processFile } from "./attachmentProcessor";
import { AttachmentNamer, ensureFolder, parentFolder } from "./naming";
import { buildLink, insertLinks } from "./linkInserter";

/** "Original" mode: keep filenames as-is and never resize, ignoring saved settings. */
const RAW_OVERRIDES = { renameFiles: false, imageResizeEnabled: false } as const;

type RunMode = "normal" | "original";

export default class AddAttachmentPlugin extends Plugin {
	settings: AddAttachmentSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Normal action = "paperclip" (attach). Original action = "files" (attach several
		// files as-is) — a related but distinct glyph so the two are told apart at a glance.
		this.addRibbonIcon("paperclip", "Attach files", () => void this.run("normal"));
		this.addRibbonIcon("files", "Attach original files (no rename or resize)", () =>
			void this.run("original"),
		);

		this.addCommand({
			id: "attach-files",
			name: "Attach files to current note",
			icon: "paperclip",
			editorCallback: () => void this.run("normal"),
		});

		this.addCommand({
			id: "attach-original-files",
			name: "Attach original files (keep names, no resize)",
			icon: "files",
			editorCallback: () => void this.run("original"),
		});

		this.addSettingTab(new AddAttachmentSettingTab(this.app, this));
	}

	/**
	 * Pick files, process each, save into the vault, and insert a link at the cursor.
	 * "original" runs with rename + resize forced off, whatever the saved settings say.
	 */
	private async run(mode: RunMode): Promise<void> {
		const settings: AddAttachmentSettings =
			mode === "original" ? { ...this.settings, ...RAW_OVERRIDES } : this.settings;

		// Require an open note before bothering the user with a file dialog.
		if (!this.app.workspace.getActiveViewOfType(MarkdownView)?.file) {
			new Notice("Add Attachment: open a note first.");
			return;
		}

		const files = await pickFiles();
		if (files.length === 0) return;

		// Re-resolve the active note AFTER the picker: the OS dialog can stay open for a
		// long time and the user may switch notes meanwhile. Insert into whatever is active
		// now — never write links into a stale editor or name files after the old note.
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.editor;
		if (!view?.file || !editor) {
			new Notice("Add Attachment: no note is open — nothing inserted.");
			return;
		}
		const note = view.file;

		// Built once per batch so the running index is shared across all files.
		const namer = settings.renameFiles
			? await AttachmentNamer.create(this.app, note.path, note.basename)
			: null;

		// links.length IS the success count, so there is no second counter to keep in
		// sync with it — a file that produced no link is failed by construction.
		const links: string[] = [];
		let done = 0;
		const progress = new Notice(`Add Attachment: 0 / ${files.length}`, 0);

		// Sequential on purpose: parallel Canvas resize of several large images
		// would spike memory and block the UI thread on mobile.
		for (const file of files) {
			try {
				const processed = await processFile(file, settings);

				const targetPath = namer
					? namer.next(this.app, processed.extension)
					: await this.app.fileManager.getAvailablePathForAttachment(file.name, note.path);

				await ensureFolder(this.app, parentFolder(targetPath));
				const created = await this.app.vault.createBinary(targetPath, processed.data);
				if (!(created instanceof TFile)) {
					// The API promises a TFile; route anything else through the failure log.
					throw new Error(`vault returned no file for ${targetPath}`);
				}
				links.push(buildLink(this.app, created, note.path));
			} catch (e) {
				console.error("[add-attachment] failed for", file.name, e);
			}
			done++;
			const pending = done - links.length;
			progress.setMessage(
				`Add Attachment: ${done} / ${files.length}${pending ? ` (${pending} failed)` : ""}`,
			);
		}

		const failed = files.length - links.length;
		const label = mode === "original" ? "original " : "";
		try {
			// One edit for the whole batch: a single undo step, and the delimiter only
			// ever lands between links.
			insertLinks(editor, links, settings.linkDelimiter);

			// Obsidian times this notice out itself — no timer of ours to leak or cancel.
			new Notice(
				`Add Attachment: ${links.length} ${label}added${failed ? `, ${failed} failed` : ""}.`,
				5000,
			);
		} finally {
			// The progress notice is persistent (timeout 0), so always take it down.
			progress.hide();
		}
	}

	async loadSettings(): Promise<void> {
		const raw = ((await this.loadData()) ?? {}) as Record<string, unknown>;

		// 0.5.0 renamed jpegQuality -> imageQuality (it also applies to webp).
		// Carry the old value over so upgrading doesn't silently reset the setting.
		let migrated = false;
		if (typeof raw.jpegQuality === "number") {
			if (raw.imageQuality === undefined) raw.imageQuality = raw.jpegQuality;
			delete raw.jpegQuality;
			migrated = true;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		if (migrated) await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
