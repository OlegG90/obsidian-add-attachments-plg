import { AddAttachmentSettings } from "./settings";

/** Formats we can decode + re-encode through Canvas. Everything else copies verbatim. */
const RESIZABLE = new Set(["jpg", "jpeg", "png", "webp"]);

const MIME_MAP: Record<string, string> = {
	png: "image/png",
	webp: "image/webp",
};

/**
 * The pinned DOM typings predate `imageOrientation: "from-image"` (the spec later made
 * it the default), so the stale member is widened here rather than casting the whole
 * options object — every other property stays type-checked.
 */
type BitmapOptions = Omit<ImageBitmapOptions, "imageOrientation"> & {
	imageOrientation?: "from-image" | "flipY" | "none";
};

/**
 * "from-image" makes EXIF rotation deterministic: older WebViews default to ignoring it
 * and would save photos rotated, while modern ones already behave this way.
 */
const BITMAP_OPTIONS: BitmapOptions = { imageOrientation: "from-image" };

export interface ProcessedFile {
	data: ArrayBuffer;
	/** Lowercased extension without the dot. Preserved from the source file. */
	extension: string;
}

export async function processFile(
	file: File,
	settings: AddAttachmentSettings,
): Promise<ProcessedFile> {
	const ext = fileExtension(file.name);

	if (settings.imageResizeEnabled && RESIZABLE.has(ext)) {
		const resized = await tryResize(file, ext, settings);
		if (resized) {
			return { data: resized, extension: ext };
		}
	}

	// No resize (disabled, non-image, already small, or decode failed) → copy as-is.
	const data = await file.arrayBuffer();
	return { data, extension: ext };
}

/**
 * Returns a resized ArrayBuffer, or null to signal "use the original untouched".
 * Null covers: image already within threshold, unsupported/undecodable format
 * (e.g. HEIC on older WebViews), or any Canvas failure — never throws.
 */
async function tryResize(
	file: File,
	ext: string,
	settings: AddAttachmentSettings,
): Promise<ArrayBuffer | null> {
	let bitmap: ImageBitmap | null = null;
	try {
		bitmap = await createImageBitmap(file, BITMAP_OPTIONS as ImageBitmapOptions);
		const { width, height } = bitmap;
		const longest = Math.max(width, height);

		if (longest <= settings.resizeThreshold) return null; // already small enough

		const scale = settings.resizeThreshold / longest;
		const w = Math.max(1, Math.round(width * scale));
		const h = Math.max(1, Math.round(height * scale));

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.drawImage(bitmap, 0, 0, w, h);

		const mime = MIME_MAP[ext] ?? "image/jpeg";
		const blob = await new Promise<Blob | null>((res) =>
			canvas.toBlob(res, mime, settings.imageQuality),
		);
		if (!blob) return null;
		return await blob.arrayBuffer();
	} catch (e) {
		console.warn("[add-attachment] resize failed, using original:", file.name, e);
		return null;
	} finally {
		bitmap?.close?.();
	}
}

/** Lowercased extension without the dot; "" for a file with no extension. */
function fileExtension(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot <= 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}
