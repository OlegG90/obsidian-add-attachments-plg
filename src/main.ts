import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import {
	AddAttachmentSettings,
	AddAttachmentSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { pickFiles } from "./attachmentPicker";
import { processFile } from "./attachmentProcessor";
import { AttachmentNamer, ensureFolder, parentFolder } from "./naming";
import { insertLink } from "./linkInserter";

/** "Original" command: keep filenames as-is and never resize, ignoring saved settings. */
const RAW_OVERRIDES = { renameFiles: false, imageResizeEnabled: false } as const;

export default class AddAttachmentPlugin extends Plugin {
	settings: AddAttachmentSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Both actions share the "paperclip" icon so they read as one family in the
		// ribbon and the mobile toolbar (tooltips/names disambiguate them).
		this.addRibbonIcon("paperclip", "Add attachments", () => void this.run());
		this.addRibbonIcon("paperclip", "Add original attachments (no rename/resize)", () =>
			void this.run(RAW_OVERRIDES),
		);

		this.addCommand({
			id: "add-attachments",
			name: "Add attachments to current note",
			icon: "paperclip",
			editorCallback: () => void this.run(),
		});

		this.addCommand({
			id: "add-original-attachments",
			name: "Add original attachments (keep names, no resize)",
			icon: "paperclip",
			editorCallback: () => void this.run(RAW_OVERRIDES),
		});

		this.addSettingTab(new AddAttachmentSettingTab(this.app, this));
	}

	/**
	 * Pick files, process each, save into the vault, and insert a link at the cursor.
	 * `overrides` force specific settings for this run (e.g. the "original" command
	 * disables rename + resize regardless of the user's saved settings).
	 */
	private async run(
		overrides?: Partial<Pick<AddAttachmentSettings, "renameFiles" | "imageResizeEnabled">>,
	): Promise<void> {
		const settings: AddAttachmentSettings = { ...this.settings, ...overrides };

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) {
			new Notice("Add Attachment: open a note first.");
			return;
		}
		const note = view.file;
		const editor = view.editor;

		const files = await pickFiles();
		if (files.length === 0) return;

		// Built once per batch so the running index is shared across all files.
		const namer = settings.renameFiles
			? await AttachmentNamer.create(this.app, note.path, note.basename)
			: null;

		let ok = 0;
		let failed = 0;

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
				if (created instanceof TFile) {
					insertLink(this.app, editor, created, note.path);
				}
				ok++;
			} catch (e) {
				console.error("[add-attachment] failed for", file.name, e);
				failed++;
			}
		}

		new Notice(`Add Attachment: ${ok} added${failed ? `, ${failed} failed` : ""}.`);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
