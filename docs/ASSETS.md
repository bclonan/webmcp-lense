# Lens assets

The new icons and preview use Lens's existing paper, green and lime palette and the Aperture mark already used by the application. No Chrome artwork is included.

`scripts/generate-brand-assets.py` renders these committed files in `apps/web/public`:

- `favicon.ico`, a real multi-size ICO with 16, 32, 48 and 64 pixel images.
- `favicon.svg`, the scalable aperture mark.
- `apple-touch-icon.png`, 180 by 180 pixels.
- `icon-192.png` and `icon-512.png`, referenced by `site.webmanifest`.
- `og-image.png`, a 1200 by 630 PNG for Open Graph and Twitter cards.

The renderer needs Python, Pillow and the Windows Segoe UI fonts used for the preview text. These are asset-generation dependencies only. Normal web builds use the committed files and need neither Python nor those fonts. To regenerate on the original Windows development machine, run `python scripts/generate-brand-assets.py`. Check the output visually before committing it.

The aperture geometry comes from the existing `lucide-vue-next` dependency under its ISC license. Its full notice is included in `apps/web/public/asset-licenses.txt` and ships with the assets. App font packages retain their own licenses.

Metadata is in `apps/web/index.html`; route titles and canonical URLs update through `apps/web/src/content/metadata.ts`. The production origin is centralized with submission URLs in `content/project.json`. If changing the actual hosting origin, update the static HTML metadata as well. Do not substitute a deploy preview origin for the public canonical URL.
