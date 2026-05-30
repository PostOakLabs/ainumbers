#!/usr/bin/env python3
"""
move_manifests.py — Move *.manifest.json from repo root → manifests/ subfolder
================================================================================
- Creates manifests/ directory if it doesn't exist
- Copies each manifest with execution.entry updated to an absolute URL
- Removes the originals from the repo root

Run once from the repo root:
  python scripts/move_manifests.py

Then commit:
  git add -A
  git commit -m "chore: move manifests to manifests/ subfolder, absolute entry URLs"
  git push
"""

import os
import json
import shutil
import sys

REPO_ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_DIR    = os.path.join(REPO_ROOT, "manifests")
SITE_BASE   = "https://ainumbers.co"

def main():
    manifest_files = sorted(
        f for f in os.listdir(REPO_ROOT)
        if f.endswith(".manifest.json")
    )

    if not manifest_files:
        print("No *.manifest.json files found in repo root — nothing to do.")
        return 0

    print(f"Found {len(manifest_files)} manifest file(s) to move.\n")

    os.makedirs(DEST_DIR, exist_ok=True)

    moved = 0
    errors = []

    for filename in manifest_files:
        src = os.path.join(REPO_ROOT, filename)
        dst = os.path.join(DEST_DIR, filename)

        try:
            with open(src, encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            errors.append(f"  SKIP (parse error) {filename}: {e}")
            continue

        # Update execution.entry to absolute URL if it's a relative path
        entry = data.get("execution", {}).get("entry", "")
        if entry and not entry.startswith("http"):
            # e.g. "tools/01-a2a-fee-route-optimizer.html"
            #   → "https://ainumbers.co/tools/01-a2a-fee-route-optimizer.html"
            data["execution"]["entry"] = f"{SITE_BASE}/{entry.lstrip('/')}"

        with open(dst, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

        os.remove(src)
        moved += 1
        print(f"  ✓  {filename}")

    print(f"\nMoved {moved} manifest(s) to manifests/")
    if errors:
        print(f"\nWarnings ({len(errors)}):")
        for e in errors:
            print(e)

    print("\nNext steps:")
    print("  git add -A")
    print('  git commit -m "chore: move manifests to manifests/ subfolder, absolute entry URLs"')
    print("  git push")
    return 0

if __name__ == "__main__":
    sys.exit(main())
