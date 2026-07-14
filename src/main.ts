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

export default class AddAttachmentPlugin extends Plugin {
	settings: AddAttachmentSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("paperclip", "Add attachments", () => void this.run());

		this.addCommand({
			id: "add-attachments",
			name: "Add attachments to current note",
			editorCallback: () => void this.run(),
		});

		this.addSettingTab(new AddAttachmentSettingTab(this.app, this));
	}

	/** Pick files, process each, save into the vault, and insert a link at the cursor. */
	private async run(): Promise<void> {
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
		const namer = this.settings.renameFiles
			? await AttachmentNamer.create(this.app, note.path, note.basename)
			: null;

		let ok = 0;
		let failed = 0;

		// Sequential on purpose: parallel Canvas resize of several large images
		// would spike memory and block the UI thread on mobile.
		for (const file of files) {
			try {
				const processed = await processFile(file, this.settings);

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
