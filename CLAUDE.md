# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website built with Hugo. A gallery experience in two levels, styled after modern minimal design-studio sites (Surendar Selvaraj, Tamaki Yoshida, aircenter). The **overview is a dark, warm, continuously-scrolling editorial index of places**: each location is a full-height section — a giant high-contrast serif name (Didot) with monospace accents (number, count) and the hero print set large beside it, revealed and gently parallaxed as you scroll. Choosing a place **zooms its print and dissolves into that location's spotlight room**: a gallery light rises from pure black onto each framed print, holds while it's viewed, then dims fully to black before the light rises on the next; tapping inside a room **"sits"** (holds the light); `.back` / Esc returns to the index (fading bright→dark→bright between overview and room). The site lands straight on the index. Everything is deliberately slow, for an unhurried, premium feel.

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
Photos live in **location folders**: `assets/images/<location>/` (e.g. `kabini/`, `masai-mara/`) — one folder per room. Drop your curated selects for a place into its folder; count per room is free. Mark the room's hero (the print shown for that location on the index) by prefixing its filename with `_`. Each image is fit within a 2048px box, converted to WebP q80, and cached — sources untouched. Tune via `.Fit "2048x2048 webp q80"` in `layouts/index.html`.

### Image Captions
Captions are parsed from the filename, split on a forgiving separator — an em-dash (`—`), en-dash (`–`), or a hyphen surrounded by spaces (` - `) all work:
```
Title—Location, Year.jpg      or      Title - Location, Year.jpg
```
Example: `A Lone Heron—Masai Mara, 2021.jpg` displays:
- Title: "A Lone Heron"
- Details: "Masai Mara, 2021"

If no separator is found, the whole filename is shown as the caption (so mistakes are visible, not silently blank).

### Frontend — the index + the spotlight
- `static/css/style.css` - Two worlds. **The index** (`.indexView`, shown under `body.strip`): a warm near-black scroller (`.ix-scroll`, hidden scrollbar) of full-height `.ix-item` sections — a giant Didot `.ix-loc` name with monospace `.ix-num`/`.ix-sub`, and the hero print `.ix-fig` set large beside it; a fixed `.ix-mast` (wordmark + count) and `.ix-hint`. Fonts: `--didone` (display serif), `--mono` (labels); colours `--ink2`/`--muted2`. **The spotlight room** (`.stage`, shown under `body.room`): warm wall gradient, spotlight/glow layers (glow tinted per-image via `--dom`), a framed print (`.frame` moulding → `.mat` passe-partout → `#photo` at its native aspect), a centred placard (`.plate`), the wordmark, and `.reveal` (the light: an oversized, heavily-blurred radial-ellipse mask). Landscape-only on touch devices in portrait (rotate prompt).
- `static/js/main.js` - Reads `window.GALLERY`. A state machine (`mode` = strip[the index] / room). **Index:** `buildIndex()` renders one `.ix-item` per location (hero + name + count); native scroll drives a rAF `parallax()` that drifts each print/name as it crosses centre, and an IntersectionObserver reveals items (`.in`). `choosePlace(el)` zooms the chosen print (`scale(1.4)`, darken) + `enterRoom(i)`; arrows/space scroll, Enter enters the centred place. **Room:** a light-level cycle (rise → hold → fall → **pure-black** gap) drives `.reveal`'s radial-ellipse gradient; the pool blooms from centre and its centre alpha tracks `1-light` so it reaches true #000 (mobile-safe). The photo swaps during the black beat; tapping "sits"; `.back` / Esc returns to the index; arrows step. `enterRoom` dissolves the index (`.gone`) then runs the slow "Now entering the … Gallery" choreography; `finishExit`→`resetIndex()` restores the index at the place you left. Dominant glow colour sampled from a 36×36 canvas; hero images **bounded-preloaded**. Slow/premium timings: RISE/FALL 4s, HOLD 7s, black 1.1s (a `prefers-reduced-motion` fast path exists).

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
