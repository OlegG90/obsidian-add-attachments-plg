import { AddAttachmentSettings } from "./settings";

/** Formats we can decode + re-encode through Canvas. Everything else copies verbatim. */
const RESIZABLE = new Set(["jpg", "jpeg", "png", "webp"]);

export interface ProcessedFile {
	data: ArrayBuffer;
	/** Lowercased extension without the dot. Preserved from the source file. */
	extension: string;
	/** Original base name without extension (used when rename is off). */
	originalBaseName: string;
}

export async function processFile(
	file: File,
	settings: AddAttachmentSettings,
): Promise<ProcessedFile> {
	const { base, ext } = splitName(file.name);

	if (settings.imageResizeEnabled && RESIZABLE.has(ext)) {
		const resized = await tryResize(file, ext, settings);
		if (resized) {
			return { data: resized, extension: ext, originalBaseName: base };
		}
	}

	// No resize (disabled, non-image, already small, or decode failed) → copy as-is.
	const data = await file.arrayBuffer();
	return { data, extension: ext, originalBaseName: base };
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
		bitmap = await createImageBitmap(file);
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

		const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
		const blob = await new Promise<Blob | null>((res) =>
			canvas.toBlob(res, mime, settings.jpegQuality),
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

function splitName(fileName: string): { base: string; ext: string } {
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0) return { base: fileName, ext: "" };
	return {
		base: fileName.slice(0, dot),
		ext: fileName.slice(dot + 1).toLowerCase(),
	};
}
