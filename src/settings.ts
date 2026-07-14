import { App, PluginSettingTab, Setting } from "obsidian";
import type AddAttachmentPlugin from "./main";

export interface AddAttachmentSettings {
	/** Rename attachments to "<note name>_<index>". Off = keep original filename. */
	renameFiles: boolean;
	/** Downscale large images before saving. Applies only to jpg/jpeg/png/webp. */
	imageResizeEnabled: boolean;
	/** Max size of the longest side, in pixels. Analog of MAX_WIDTH in images_resize.py. */
	resizeThreshold: number;
	/** Encode quality 0.1–1.0, applied when re-encoding a resized image. */
	jpegQuality: number;
}

export const DEFAULT_SETTINGS: AddAttachmentSettings = {
	renameFiles: true,
	imageResizeEnabled: true,
	resizeThreshold: 1600,
	jpegQuality: 0.85,
};

export class AddAttachmentSettingTab extends PluginSettingTab {
	private readonly plugin: AddAttachmentPlugin;

	constructor(app: App, plugin: AddAttachmentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Rename attached files")
			.setDesc('Rename to "<note name>_<index>". Turn off to keep the original filename.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.renameFiles).onChange(async (v) => {
					this.plugin.settings.renameFiles = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Resize images")
			.setDesc("Downscale large images (jpg/png/webp) before saving.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.imageResizeEnabled).onChange(async (v) => {
					this.plugin.settings.imageResizeEnabled = v;
					await this.plugin.saveSettings();
					this.display(); // refresh so the fields below reflect the new state
				}),
			);

		if (this.plugin.settings.imageResizeEnabled) {
			new Setting(containerEl)
				.setName("Resize threshold (px)")
				.setDesc("Longest side. Images larger than this are scaled down proportionally.")
				.addText((t) =>
					t
						.setPlaceholder("1600")
						.setValue(String(this.plugin.settings.resizeThreshold))
						.onChange(async (v) => {
							const n = parseInt(v, 10);
							if (!Number.isNaN(n) && n > 0) {
								this.plugin.settings.resizeThreshold = n;
								await this.plugin.saveSettings();
							}
						}),
				);

			new Setting(containerEl)
				.setName("Image quality")
				.setDesc("0.1–1.0. Applied when re-encoding resized jpg/webp images.")
				.addSlider((s) =>
					s
						.setLimits(0.1, 1, 0.05)
						.setValue(this.plugin.settings.jpegQuality)
						.setDynamicTooltip()
						.onChange(async (v) => {
							this.plugin.settings.jpegQuality = v;
							await this.plugin.saveSettings();
						}),
				);
		}
	}
}
