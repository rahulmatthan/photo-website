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
- `layouts/index.html` - Homepage that reads images from `static/images/`, shuffles them randomly, and generates slides with caption data attributes

### Image Captions
Captions are parsed from filenames using em-dash (`—`) as separator:
```
Location, Year—Title.jpg
```
Example: `Masai Mara, 2021—Baby Blue.jpg` displays:
- Location: "Masai Mara, 2021"
- Details: "Baby Blue"

Fallback captions can be defined in `data/captions.yaml`.

### Frontend
- `static/css/style.css` - Fixed header (logo) and footer (caption) layout, fade transitions, hover zones for navigation arrows
- `static/js/main.js` - Slideshow logic with 7-second auto-advance, caption fade timing (2s delay in, 1s early out), keyboard/click navigation

### Deployment
GitHub Actions workflow (`.github/workflows/hugo.yaml`) builds and deploys to GitHub Pages on push to `main`. Custom domain: photos.rahulmatthan.com
