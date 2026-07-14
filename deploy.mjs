// Copies the built plugin into the Obsidian vault's plugins folder.
// Override the vault path with the OBSIDIAN_VAULT env var if it ever moves.
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import process from "process";

const VAULT = process.env.OBSIDIAN_VAULT || "C:/Workspace/Library/Obsidian/myVault";
const PLUGIN_ID = "add-attachment";
const FILES = ["manifest.json", "main.js", "styles.css"];

const dest = join(VAULT, ".obsidian", "plugins", PLUGIN_ID);
mkdirSync(dest, { recursive: true });

for (const f of FILES) {
	if (!existsSync(f)) {
		console.error(`[deploy] missing ${f} — run "npm run build" first`);
		process.exit(1);
	}
	copyFileSync(f, join(dest, f));
	console.log(`[deploy] ${f} -> ${join(dest, f)}`);
}

console.log('[deploy] done. In Obsidian: Settings -> Community plugins -> reload (or toggle) "Add Attachment".');
