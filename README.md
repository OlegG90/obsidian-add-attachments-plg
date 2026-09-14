# Add Attachment

Attach **several files at once** to the current note, with a link inserted for each —
optionally renamed after the note and downscaled if they are images.

Works on **desktop and mobile** (Android in particular): one bundle, no Node.js or
native dependencies.

## What it does

- **Pick many files in one go.** One dialog, one batch, links inserted at the cursor in a
  single edit — so a batch is a single undo step.
- **Saves where you told Obsidian to.** The target folder comes from
  *Settings → Files and links → Default location for new attachments*; the plugin never
  second-guesses that setting.
- **Optional rename** to `<note name>_<index>.<ext>`, so attachments sort next to the note
  they belong to instead of carrying names like `IMG_20240115_882341.jpg`.
- **Optional image downscaling** to a pixel threshold on the longest side, re-encoded at a
  quality you choose. Useful when notes collect phone photos.
- **A second command that skips all of it**, for when you want the file exactly as it is.

## How it differs from similar plugins

Several plugins insert multiple attachments. This one adds the two steps people usually
automate afterwards with scripts:

- **Renaming** with a collision-safe index — the next index is `MAX(existing) + 1`, not
  `count + 1`, so deleting an attachment from the middle can never make a new file
  overwrite an existing one.
- **Resizing** on the way in, so large photos never enter the vault at full size.

If you only need the links and no processing, a simpler plugin will serve you better.

## Commands

| Command | Rename | Resize |
|---|---|---|
| **Attach files to current note** | per settings | per settings |
| **Attach original files (keep names, no resize)** | always off | always off |

Both are available from the command palette and as ribbon icons, and both can be added to
the mobile toolbar.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Rename attached files | on | off = keep the original filename |
| Resize images | on | jpg / jpeg / png / webp only |
| Resize threshold (px) | 1600 | longest side, 64–20000 |
| Image quality | 0.85 | jpg / webp re-encode quality |
| Separator between links | new line | inserted between links of a batch, not after the last |

The attachment folder is deliberately **not** duplicated here — it belongs to Obsidian's
own settings.

## Known limitations

**Memory on very large photos (mobile).** Resizing decodes the image at full resolution
first, so peak memory is driven by the source dimensions, not the target ones — a 40+ MP
photo needs a few hundred MB while it is being scaled. On a low-RAM device that decode can
fail.

It fails *safely*: the file is copied through at its original size and a warning is logged
to the console. You get the attachment either way; it just isn't downscaled. Files are
processed one at a time specifically so several large photos can't pile up in memory.

**Other formats.** SVG and animated GIF are never resized (they would lose vector data or
animation) and pass through untouched. HEIC photos may not decode in older Android
WebViews — same safe fallback: copied at original size.

## Installation

Once listed in Community plugins: *Settings → Community plugins → Browse → Add
Attachment*.

Meanwhile, either install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat)
from this repository, or do it manually: download `manifest.json`, `main.js` and
`styles.css` from the [latest release](../../releases/latest) into
`<your vault>/.obsidian/plugins/add-attachment/`, then enable the plugin.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # type-check + production bundle
npm run deploy   # copy manifest.json + main.js + styles.css into a vault
```

Set `OBSIDIAN_VAULT` to your vault path before `npm run deploy` (`deploy.mjs` falls back
to the author's path otherwise). There is no live reload on mobile: build on desktop and
let the plugin folder sync to the device, then reload the app.

## License

MIT — see [LICENSE](LICENSE).
