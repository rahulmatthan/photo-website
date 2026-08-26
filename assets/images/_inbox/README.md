# Drop-box for new photographs

Upload new photos **here** — into this `_inbox` folder — and the deploy will
automatically file each one into the right location folder, then build the site.

## How it works

Every image's filename carries its caption **and** its destination:

```
Title — Location, Year.jpg
```

The separator can be an em-dash (`—`), en-dash (`–`), or a spaced hyphen (` - `).
On the next push, `scripts/sort-inbox.py` (run by the deploy workflow) reads the
**Location**, moves the file to `assets/images/<location>/`, and empties this
folder again.

Examples:

| Filename you upload                     | Lands in            |
| --------------------------------------- | ------------------- |
| `Grazing - Ngorongoro, 2023.jpg`        | `ngorongoro/`       |
| `A Lone Heron — Masai Mara, 2021.jpg`   | `masai-mara/`       |
| `First Light - Serengeti, 2024.jpg`     | `serengeti/` (new)  |

## Notes

- **A new location** (one with no folder yet) gets its own folder and is added
  to `data/locations.yaml` under **World** by default — edit that file to move it
  under **India**.
- Mark a location's **hero** print (the one shown on the index) by prefixing its
  filename with an underscore: `_Blackie — Kabini, 2020.jpg`.
- A file with **no “— Location”** in its name is left here untouched so the
  mistake is visible.
- Uploading via GitHub's web UI works too: open this folder → *Add file → Upload
  files* → commit.
