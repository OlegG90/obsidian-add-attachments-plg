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
	/** Text inserted BETWEEN links of one batch (not after the last one). */
	linkDelimiter: string;
}

export const DEFAULT_SETTINGS: AddAttachmentSettings = {
	renameFiles: true,
	imageResizeEnabled: true,
	resizeThreshold: 1600,
	jpegQuality: 0.85,
	linkDelimiter: "\n",
};

/** Sane bounds for the resize threshold, in pixels. */
export const THRESHOLD_MIN = 64;
export const THRESHOLD_MAX = 20000;

/**
 * Delimiter choices offered in settings. A dropdown rather than a free text field:
 * on mobile there is no sane way to type "\n", and the analog plugin's ␣/↵
 * placeholder trick is confusing.
 */
const DELIMITER_OPTIONS: Record<string, string> = {
	"\n": "New line — one link per line",
	"\n\n": "Blank line — paragraph between links",
	" ": "Space — links in one line",
	"": "Nothing — links glued together",
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
				.setDesc(
					`Longest side. Images larger than this are scaled down proportionally. ${THRESHOLD_MIN}–${THRESHOLD_MAX}.`,
				)
				.addText((t) => {
					t.setPlaceholder(String(DEFAULT_SETTINGS.resizeThreshold)).setValue(
						String(this.plugin.settings.resizeThreshold),
					);

					// Numeric input: on Android this brings up the number keypad and the
					// browser itself rejects non-digits.
					t.inputEl.type = "number";
					t.inputEl.min = String(THRESHOLD_MIN);
					t.inputEl.max = String(THRESHOLD_MAX);

					// Save only valid in-range values while typing...
					t.onChange(async (v) => {
						const n = parseInt(v, 10);
						if (!Number.isNaN(n) && n >= THRESHOLD_MIN && n <= THRESHOLD_MAX) {
							this.plugin.settings.resizeThreshold = n;
							await this.plugin.saveSettings();
						}
					});

					// ...and on blur clamp/restore, so the field can never be left showing
					// a value that was not actually stored.
					t.inputEl.addEventListener("blur", async () => {
						const n = parseInt(t.inputEl.value, 10);
						const clamped = Number.isNaN(n)
							? this.plugin.settings.resizeThreshold
							: Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, n));
						this.plugin.settings.resizeThreshold = clamped;
						t.setValue(String(clamped));
						await this.plugin.saveSettings();
					});
				});

			// The value is shown in the description rather than via setDynamicTooltip(),
			// which is deprecated since Obsidian 1.13 (sliders show it inline now) but
			// would leave 1.5.7–1.12 users with no readout at all.
			const qualityDesc = (v: number): string =>
				`0.1–1.0. Applied when re-encoding resized jpg/webp images. Current: ${v.toFixed(2)}`;

			const quality = new Setting(containerEl)
				.setName("Image quality")
				.setDesc(qualityDesc(this.plugin.settings.jpegQuality))
				.addSlider((s) =>
					s
						.setLimits(0.1, 1, 0.05)
						.setValue(this.plugin.settings.jpegQuality)
						.onChange(async (v) => {
							this.plugin.settings.jpegQuality = v;
							quality.setDesc(qualityDesc(v));
							await this.plugin.saveSettings();
						}),
				);
		}

		// Outside the resize block: applies to every batch, images or not.
		new Setting(containerEl)
			.setName("Separator between links")
			.setDesc("Inserted between the links of one batch, not after the last one.")
			.addDropdown((d) => {
				for (const [value, label] of Object.entries(DELIMITER_OPTIONS)) {
					d.addOption(value, label);
				}
				d.setValue(this.plugin.settings.linkDelimiter).onChange(async (v) => {
					this.plugin.settings.linkDelimiter = v;
					await this.plugin.saveSettings();
				});
			});
	}
}
