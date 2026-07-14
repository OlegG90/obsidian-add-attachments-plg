# Add Attachment

Obsidian plugin: attach **multiple files at once** to the current note, with an auto-inserted
link for each. Optional rename to `<note name>_<index>` and optional image downscaling.
Runs on **desktop and mobile (Android focus)** — one bundle, no Node.js or native deps.

## Features

- Pick several files in one go (`input[type=file] multiple`).
- Saves them to the folder from Obsidian's *Files & Links → Default location for new attachments*
  (never parsed by hand — resolved via `getAvailablePathForAttachment`).
- Inserts a link at the cursor, embed (`![[...]]`) for images/audio/video/pdf.
- **Rename** (optional): `<note>_<index>.<ext>`, indexed by `MAX(existing) + 1` with a
  collision guard so gaps from manual deletion never overwrite a file.
- **Resize images** (optional): downscale to a pixel threshold on the longest side via Canvas.

See the design note (`../AddAttachment.md`) for the full architecture and the naming/conflict rules.

This repo lives **outside** the Obsidian vault (`C:\Workspace\Sandbox\Projects\Obsidian_Plg\add-attachment`)
so that `node_modules`, git, and build tooling never end up in the notes vault or its Syncthing sync.
The design/spec notes stay in the vault at `Projects/Obsidian/AddAttachment/`.

## Build

```bash
npm install
npm run dev            # watch build → main.js
npm run build          # type-check + production bundle
npm run deploy         # copy manifest.json + main.js + styles.css into the vault
npm run build:deploy   # build then deploy in one step
```

`deploy.mjs` copies the three artifacts into
`<vault>/.obsidian/plugins/add-attachment/`. The vault path defaults to
`C:/Workspace/Library/Obsidian/myVault`; override with the `OBSIDIAN_VAULT` env var.

After deploy, enable/reload the plugin in *Settings → Community plugins*.

**Mobile:** there is no live dev server. Build + deploy on desktop; the plugin folder under
`.obsidian/plugins/` then syncs to the phone (Syncthing) — reload the app to pick it up.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Rename attached files | on | off = keep original filename |
| Resize images | on | jpg / jpeg / png / webp only |
| Resize threshold (px) | 1600 | longest side |
| Image quality | 0.85 | jpg / webp re-encode quality |
