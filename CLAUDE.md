# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website built with Hugo. A gallery experience in two levels. The **overview is a full-screen portfolio book** you leaf through: each leaf is one location — the hero photograph centred at its full aspect ratio on a cream page (faint centre fold), with a small caption (name · count · "enter the gallery") in the lower corner — and the whole page turns with a 3D flip around the spine edge, so the image turns *with* the page in both directions. Tapping the photograph **enters that location's spotlight room**: a gallery light rises from pure black onto each framed print, holds while it's viewed, then dims fully to black before the light rises on the next; tapping inside a room **"sits"** (holds the light); `.back` / Esc returns to the book. An entry **title wall** opens the experience (and requests browser fullscreen on the entry tap). Everything is deliberately slow, for an unhurried, premium feel.

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
Photos live in **location folders**: `assets/images/<location>/` (e.g. `kabini/`, `masai-mara/`) — one folder per room. Drop your curated selects for a place into its folder; count per room is free. Mark the room's hero (the plate shown on that location's book spread) by prefixing its filename with `_`. Each image is fit within a 2048px box, converted to WebP q80, and cached — sources untouched. Tune via `.Fit "2048x2048 webp q80"` in `layouts/index.html`.

### Image Captions
Captions are parsed from the filename, split on a forgiving separator — an em-dash (`—`), en-dash (`–`), or a hyphen surrounded by spaces (` - `) all work:
```
Title—Location, Year.jpg      or      Title - Location, Year.jpg
```
Example: `A Lone Heron—Masai Mara, 2021.jpg` displays:
- Title: "A Lone Heron"
- Details: "Masai Mara, 2021"

If no separator is found, the whole filename is shown as the caption (so mistakes are visible, not silently blank). Fallback captions can also be defined in `data/captions.yaml`, keyed by filename.

### Frontend — the book + the spotlight
- `static/css/style.css` - Two worlds. **The book** (`.book` / `.spread`, shown under `body.strip`): a single cream `.sheet` with a faint centre fold, the photograph centred at full aspect (`.pimg`, `object-fit:contain`) and a small `.cap` caption, plus a `.leaf` (one `.leaf-face`, `backface-visibility:hidden`) that rotates the whole page around the spine edge to turn it (`--flip` duration). **The spotlight room** (`.stage`, shown under `body.room`): warm wall gradient, spotlight/glow layers (glow tinted per-image via `--dom`), a framed print (`.frame` moulding → `.mat` passe-partout → `#photo` at its native aspect), a centred placard (`.plate`), the wordmark, and `.reveal` (the light: an oversized, heavily-blurred radial-ellipse mask). Landscape-only on touch devices in portrait (rotate prompt).
- `static/js/main.js` - Reads `window.GALLERY`. A state machine (`mode` = entry / strip[the book] / room). **Book:** `showSpread(i)` renders the photograph + caption for location `i` into `#sheet` via `sheetHTML`; `turn(dir)` turns the whole page as one leaf hinged at the spine edge — forward: the current page rides the leaf and swings away (back hidden past 90°) revealing the next beneath; backward: the previous page swings back in and lands on top — so the image turns with the page both ways. Swipe / two-finger scroll / arrows turn pages; tapping the photograph or the "enter" cue opens the room. **Room:** a light-level cycle (rise → hold → fall → **pure-black** gap) drives `.reveal`'s radial-ellipse gradient; the pool blooms from centre and its centre alpha tracks `1-light` so it reaches true #000 (mobile-safe). The photo swaps during the black beat; tapping "sits"; `.back` / Esc returns to the book; arrows step. `enterRoom` runs the slow "Now entering the … Gallery" choreography. Dominant glow colour sampled from a 36×36 canvas; hero images **bounded-preloaded** (current + neighbours). Slow/premium timings: flip 1.2s, RISE/FALL 4s, HOLD 7s, black 1.1s (a `prefers-reduced-motion` fast path exists).

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
