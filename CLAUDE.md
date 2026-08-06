# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website built with Hugo. Presents each photograph as a framed, matted print hung on a dark wall — a gallery spotlight rises from pure black onto the print, holds while it's viewed, then dims fully to black before the light rises on the next photograph. Concept codename: "The Hide". Captions are parsed from filenames and shown as a centred gallery placard.

## Commands

```bash
# Development server (watches for changes)
hugo server

# Build for production
hugo

# Auto-deploy watcher (commits & pushes image changes)
./watch-and-deploy.sh
```

## Architecture

### Layout Structure
- `layouts/_default/baseof.html` - Base template with minimal structure
- `layouts/index.html` - Homepage that reads images from `assets/images/`, resizes/optimizes them via Hugo's image pipeline, shuffles them, and emits the room DOM plus a `window.IMAGES` JS array (`{src, title, place}` per photo) via `jsonify | safeJS`

### Images & Optimization
Photos live in `assets/images/` (Hugo's asset pipeline, **not** `static/`). At build time each image is fit within a 2048px box, converted to WebP at quality 80, and cached — the source files are left untouched. To add a photo, drop a correctly-named file into `assets/images/`. Tune the size/quality via the `.Fit "2048x2048 webp q80"` call in `layouts/index.html`.

### Image Captions
Captions are parsed from the filename, split on a forgiving separator — an em-dash (`—`), en-dash (`–`), or a hyphen surrounded by spaces (` - `) all work:
```
Title—Location, Year.jpg      or      Title - Location, Year.jpg
```
Example: `A Lone Heron—Masai Mara, 2021.jpg` displays:
- Title: "A Lone Heron"
- Details: "Masai Mara, 2021"

If no separator is found, the whole filename is shown as the caption (so mistakes are visible, not silently blank). Fallback captions can also be defined in `data/captions.yaml`, keyed by filename.

### Frontend — "The Hide" gallery spotlight
- `static/css/style.css` - The dark room: warm wall gradient, spotlight/glow layers (glow tinted per-image via `--dom`), a framed print (`.frame` moulding → `.mat` passe-partout → `#photo` at its native aspect), a centred gallery placard (`.plate` — italic-serif title, hairline rule, tracked-caps place/year), the wordmark, and `.reveal` (the light: an oversized, heavily-blurred radial-ellipse mask). Landscape-only on touch devices in portrait (rotate prompt).
- `static/js/main.js` - Reads `window.IMAGES`. A light-level state machine (rise → hold → fall → **pure-black** gap) drives `.reveal`'s radial-ellipse gradient so the light blooms from the image centre outward and retreats to true #000; the photo swaps during the black beat. Dominant colour for the glow is sampled from a 36×36 canvas. Images are **bounded-preloaded** (current + next only), so per-visit bandwidth stays constant at any library size. Click / arrow keys / touch advance early. Timings: RISE/FALL 3s, HOLD 5.2s.

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
