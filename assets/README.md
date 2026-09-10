# Source Artwork

This directory keeps EMORI's intentional high-resolution and variant source
artwork for future avatars, skill icons, stickers, and release art.

- `icon-large*.png` and `composer-icon.svg` are source icon artwork.
- `emori-sticker*.png` are source sticker variants.

Runtime-ready derivatives belong in `avatars/`. Workspace skills reference
`composer-icon.svg` and `icon-large.png` here directly; do not copy them into
each skill. Only distinct skill-specific artwork belongs in `skills/*/assets/`.
Retain intentional source variants even when they are not currently referenced.
