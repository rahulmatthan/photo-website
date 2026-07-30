# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website built with Hugo. Displays full-screen images with fade transitions, random ordering, and captions parsed from filenames.

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
- `layouts/index.html` - Homepage that reads images from `assets/images/`, resizes/optimizes them via Hugo's image pipeline, shuffles them randomly, and generates slides with caption data attributes

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

### Frontend
- `static/css/style.css` - Fixed header (logo) and footer (caption) layout, fade transitions, hover zones for navigation arrows
- `static/js/main.js` - Slideshow logic with 7-second auto-advance, caption fade timing (2s delay in, 1s early out), keyboard/click navigation. Images are preloaded in a bounded window around the current slide, and each transition waits for the incoming image to load — so per-visit bandwidth stays constant regardless of library size and no broken frames appear.

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
