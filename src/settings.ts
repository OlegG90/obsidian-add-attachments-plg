import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type AddAttachmentPlugin from "./main";

export interface AddAttachmentSettings {
	/** Rename attachments to "<note name>_<index>". Off = keep original filename. */
	renameFiles: boolean;
	/** Downscale large images before saving. Applies only to jpg/jpeg/png/webp. */
	imageResizeEnabled: boolean;
	/** Max size of the longest side, in pixels. Analog of MAX_WIDTH in images_resize.py. */
	resizeThreshold: number;
	/** Encode quality 0.1–1.0, applied when re-encoding a resized jpg/webp. */
	imageQuality: number;
	/** Text inserted BETWEEN links of one batch (not after the last one). */
	linkDelimiter: string;
}

export const DEFAULT_SETTINGS: AddAttachmentSettings = {
	renameFiles: true,
	imageResizeEnabled: true,
	resizeThreshold: 1600,
	imageQuality: 0.85,
	linkDelimiter: "\n",
};

/** Sane bounds for the resize threshold, in pixels. */
export const THRESHOLD_MIN = 64;
export const THRESHOLD_MAX = 20000;

/**
 * Delimiter choices. A dropdown rather than a free text field: on mobile there
 * is no sane way to type "\n".
 */
const DELIMITER_OPTIONS: Record<string, string> = {
	"\n": "New line — one link per line",
	"\n\n": "Blank line — paragraph between links",
	" ": "Space — links in one line",
	"": "Nothing — links glued together",
};

type SettingKey = keyof AddAttachmentSettings;

/**
 * Declarative settings tab (Obsidian 1.13+). We return definitions instead of
 * building DOM in display(): Obsidian renders them, wires persistence through
 * get/setControlValue, and makes every setting searchable for free.
 */
export class AddAttachmentSettingTab extends PluginSettingTab {
	private readonly plugin: AddAttachmentPlugin;

	constructor(app: App, plugin: AddAttachmentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		const resizeOn = (): boolean => this.plugin.settings.imageResizeEnabled;

		return [
			{
				name: "Rename attached files",
				desc: 'Rename to "<note name>_<index>". Turn off to keep the original filename.',
				control: { type: "toggle", key: "renameFiles" },
			},
			{
				name: "Resize images",
				desc: "Downscale large images (jpg/png/webp) before saving.",
				control: { type: "toggle", key: "imageResizeEnabled" },
			},
			{
				name: "Resize threshold (px)",
				desc: "Longest side. Images larger than this are scaled down proportionally.",
				// Replaces the old manual display() re-render; see setControlValue.
				visible: resizeOn,
				control: {
					type: "number",
					key: "resizeThreshold",
					min: THRESHOLD_MIN,
					max: THRESHOLD_MAX,
					step: 1,
					placeholder: String(DEFAULT_SETTINGS.resizeThreshold),
					validate: (v) =>
						Number.isInteger(v) && v >= THRESHOLD_MIN && v <= THRESHOLD_MAX
							? undefined
							: `Enter a whole number between ${THRESHOLD_MIN} and ${THRESHOLD_MAX}.`,
				},
			},
			{
				name: "Image quality",
				desc: "Applied when re-encoding resized jpg/webp images.",
				visible: resizeOn,
				control: {
					type: "slider",
					key: "imageQuality",
					min: 0.1,
					max: 1,
					step: 0.05,
					// Without this, float steps can read as 0.8500000000000001.
					displayFormat: (v) => v.toFixed(2),
				},
			},
			{
				name: "Separator between links",
				desc: "Inserted between the links of one batch, not after the last one.",
				control: { type: "dropdown", key: "linkDelimiter", options: DELIMITER_OPTIONS },
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();

		// The threshold/quality rows are bound to the resize toggle: re-evaluate
		// their `visible` predicates in place (cheap, no re-render).
		if (key === "imageResizeEnabled") this.refreshDomState();
	}
}
