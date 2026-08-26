#!/usr/bin/env python3
"""Sort freshly-uploaded photographs out of assets/images/_inbox/ into the
correct location subfolder, derived from each filename's caption:

    Title — Location, Year.jpg        (em-dash, en-dash, or " - " all work)

e.g.  "Grazing - Ngorongoro, 2023.jpg"  ->  assets/images/ngorongoro/

A location name that matches an existing folder (case/spacing-insensitive) drops
the photo straight in. A genuinely new location name creates its own folder and
appends a default "{ group: World }" line to data/locations.yaml (edit that to
move it under India). A misspelt location therefore shows up as a new folder —
that is deliberate: it surfaces the typo instead of silently misfiling.

Run from the repo root. A no-op when the inbox is empty, so it is safe to run
on every build.
"""
import os, re, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "assets", "images")
INBOX = os.path.join(IMAGES, "_inbox")
LOCATIONS = os.path.join(ROOT, "data", "locations.yaml")
EXT = (".jpg", ".jpeg", ".png", ".webp")


def slugify(s):
    s = s.strip().lower()
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    return re.sub(r"-+", "-", s).strip("-")


def location_from_name(name):
    stem = re.sub(r"(?i)\.(jpg|jpeg|png|webp)$", "", name).lstrip("_")   # drop ext + hero marker
    norm = re.sub(r"\s*[—–]\s*", "—", stem)               # em / en dash -> —
    norm = re.sub(r"\s+-\s+", "—", norm)                            # spaced hyphen -> —
    parts = norm.split("—")
    if len(parts) < 2:
        return None
    return parts[1].split(",")[0].strip()                               # location, sans year


def existing_folders():
    return sorted(d for d in os.listdir(IMAGES)
                  if os.path.isdir(os.path.join(IMAGES, d)) and not d.startswith("_"))


def ensure_location_yaml(slug):
    try:
        with open(LOCATIONS, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        content = ""
    if re.search(rf"(?m)^{re.escape(slug)}\s*:", content):
        return False
    if content and not content.endswith("\n"):
        content += "\n"
    content += f"{slug}:".ljust(13) + "{ group: World }\n"
    with open(LOCATIONS, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def main():
    if not os.path.isdir(INBOX):
        print("No _inbox folder; nothing to do.")
        return 0
    files = [f for f in os.listdir(INBOX)
             if f.lower().endswith(EXT) and os.path.isfile(os.path.join(INBOX, f))]
    if not files:
        print("Inbox empty; nothing to sort.")
        return 0

    folders = existing_folders()
    moved, skipped, new_locs = [], [], []

    for f in sorted(files):
        place = location_from_name(f)
        if not place:
            skipped.append((f, "no “— Location” found in filename"))
            continue
        slug = slugify(place)
        if not slug:
            skipped.append((f, "empty location after slugifying"))
            continue

        target_dir = os.path.join(IMAGES, slug)
        brand_new = not os.path.isdir(target_dir)
        os.makedirs(target_dir, exist_ok=True)

        dest = os.path.join(target_dir, f)
        if os.path.exists(dest):
            skipped.append((f, f"already present in {slug}/"))
            continue

        shutil.move(os.path.join(INBOX, f), dest)
        moved.append((f, slug))
        if brand_new and slug not in folders:
            folders.append(slug)
            if ensure_location_yaml(slug):
                new_locs.append(slug)

    print(f"Sorted {len(moved)} image(s):")
    for f, slug in moved:
        print(f"  {f}  ->  {slug}/")
    if new_locs:
        print("\nNEW location folder(s) created (defaulted to group: World — "
              "edit data/locations.yaml to move under India):")
        for s in new_locs:
            print(f"  {s}")
    if skipped:
        print("\nLeft in _inbox (couldn't place):")
        for f, why in skipped:
            print(f"  {f}  ({why})")

    gh = os.environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a") as out:
            out.write(f"moved={len(moved)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
