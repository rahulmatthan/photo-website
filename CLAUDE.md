# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website built with Hugo. A gallery experience: each photograph is a framed, matted print hung on a dark wall — a gallery spotlight rises from pure black onto the print, holds while it's viewed, then dims fully to black before the light rises on the next. Two levels: a **collection wall** cycles one hero print per location; tapping a print **enters that location's room** of photographs (which cycles then returns to the wall on its own); tapping inside a room **"sits"** (holds the light). An entry **title wall** opens the experience. Everything is deliberately slow, for an unhurried, premium feel.

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
- `layouts/index.html` - Reads the **location folders** under `assets/images/<location>/`, processes each image via Hugo's pipeline, and emits `window.GALLERY = {rooms:[{key, title, count, heroIdx, photos:[{src,title,place}]}]}` via `jsonify | safeJS`. Room title = prettified folder name; the hero is the image whose filename starts with `_` (stripped for display), else the first.

### Images & Optimization
Photos live in **location folders**: `assets/images/<location>/` (e.g. `kabini/`, `masai-mara/`) — one folder per room. Drop your curated selects for a place into its folder; count per room is free. Mark the room's hero (shown on the collection wall) by prefixing its filename with `_`. Each image is fit within a 2048px box, converted to WebP q80, and cached — sources untouched. Tune via `.Fit "2048x2048 webp q80"` in `layouts/index.html`.

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
- `static/js/main.js` - Reads `window.GALLERY`. A two-level state machine (`mode` = entry / wall / room) plus a light-level cycle (rise → hold → fall → **pure-black** gap) that drives `.reveal`'s radial-ellipse gradient; the pool blooms from centre and its centre alpha tracks `1-light` so it reaches true #000 (mobile-safe). The photo swaps during the black beat, applying a pending action (next / prev / enter / back). Tap: on the wall enters a room, in a room "sits"; `.back` / Esc returns; arrows step. Dominant glow colour sampled from a 36×36 canvas; images **bounded-preloaded** (current + next). Slow/premium timings: RISE/FALL 4s, HOLD 7s, black 1.1s (a `prefers-reduced-motion` fast path exists).

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
