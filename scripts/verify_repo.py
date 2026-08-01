#!/usr/bin/env python3
"""
verify_repo.py — S1 deploy gate (hard gate — exits 1 on failure)

Five checks, all hard failures that block deploy:
  1. PII text correctness  — any pii-notice div must have canonical §1.3 text
  2. Manifest coverage     — every tools/*.html must have a .manifest.json
  3. AP2 consistency       — manifests with ap2_export:true must have the button in HTML
  4. Sitemap coverage      — every published page (scripts/published-dirs.json's dir
                             list: tools/, guides/, chaingraph/, disclosures/, docs/,
                             ledger/, attestations/) is in sitemap.xml (DISCOVER-1 §D-2)
  5. Hash + syntax gates   — Node: JS syntax parse, forbidden-hash lint, golden
                             execution_hash parity, art-01 canonicalizer self-test
                             (soft-skips only if Node is absent; CI always enforces)

Usage:
  python scripts/verify_repo.py                     # full-estate scan (CI default)
  python scripts/verify_repo.py --changed <ref>      # incremental: only files touched vs <ref>
                                                      # (pre-push hook default — CI always runs full)

--changed scopes checks 1-4 (PII/manifest/AP2/sitemap) to touched files, and skips the
Node hash/syntax gates entirely when no kernel-relevant path changed (they scan every
kernel regardless of git diff, so skipping is only safe when nothing they cover moved).
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TOOLS = REPO / "tools"
GUIDES = REPO / "guides"
MANIFESTS = REPO / "manifests"
SITEMAP = REPO / "sitemap.xml"
KERNELS = REPO / "chaingraph" / "kernels"
WORKBENCH = REPO / "chaingraph" / "workbench"
CANVAS = REPO / "chaingraph" / "canvas"

# Node-based gates (OpenChainGraph hash integrity + JS syntax). Each exits non-zero on failure.
HASH_GATES = [
    ("JS syntax",            "syntax-check.mjs"),        # every inline classic script parses
    ("forbidden-hash lint",  "lint-forbidden-hash.mjs"), # no array-replacer / fake simpleHash
    ("golden parity",        "golden-parity.test.mjs"),  # pinned execution_hash drift
    ("art-01 kernel parity", "parity-art-01.test.mjs"),  # canonicalizer self-test
    ("kernel contract",      "kernel-contract.test.mjs"),# every kernel ships a fixture + buildArtifact is self-consistent (live hash_valid)
    ("kernel hash integrity","kernel-hash-integrity.mjs"),# fixture-free: every live gpu:false kernel emits a self-consistent canonical hash (debt ratchet)
]

# CONTRACT §1.3 canonical PII text prefix (enough to confirm correct wording)
CANON_PII_PREFIX = (
    "\U0001f512 All inputs are processed locally in your browser. "
    "No data is transmitted."
)

errors = []


def fail(msg):
    errors.append(msg)


# ── --changed support ──────────────────────────────────────────────────────────
def get_changed_files(ref):
    """Union of files touched vs <ref> (committed) and in the working tree (uncommitted).
    Returns None if git or <ref> is unavailable — caller falls back to a full scan."""
    if not shutil.which("git"):
        return None
    try:
        subprocess.run(["git", "rev-parse", "--verify", ref],
                        cwd=str(REPO), capture_output=True, text=True, check=True)
    except Exception:
        print(f"  ⚠️  --changed {ref}: ref not resolvable — falling back to full scan")
        return None
    changed = set()
    for cmd in (["git", "diff", "--name-only", f"{ref}...HEAD"],
                ["git", "diff", "--name-only", "HEAD"],
                ["git", "status", "--porcelain"]):
        res = subprocess.run(cmd, cwd=str(REPO), capture_output=True, text=True)
        if res.returncode != 0:
            print(f"  ⚠️  `{' '.join(cmd)}` failed (exit {res.returncode}) — falling back to full scan")
            return None
        for line in res.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            # `git status --porcelain` prefixes each line with a 2-char status code.
            if cmd[1] == "status":
                line = line[3:]
            changed.add(line)
    return changed


def _touched(paths, changed):
    """Filter an iterable of Path objects to those whose repo-relative path is in `changed`."""
    if changed is None:
        return list(paths)
    return [p for p in paths if str(p.relative_to(REPO)).replace("\\", "/") in changed]


# ── Check 1: PII text correctness ─────────────────────────────────────────────
def _pii_scan_dirs():
    dirs = [TOOLS]
    if WORKBENCH.is_dir():
        dirs.append(WORKBENCH)
    if CANVAS.is_dir():
        dirs.append(CANVAS)
    return dirs


def check_pii_text(changed=None):
    bad = []
    scanned = 0
    n = 0
    for d in _pii_scan_dirs():
        for path in _touched(sorted(d.glob("*.html")), changed):
            scanned += 1
            text = path.read_text(encoding="utf-8", errors="replace")
            m = re.search(r'<div\s+class="(?:pii-notice|pii-bar)">(.*?)</div>', text, re.S)
            if m:
                n += 1
                if CANON_PII_PREFIX not in m.group(1):
                    bad.append(str(path.relative_to(REPO)))
    if bad:
        fail(f"[PII] {len(bad)} page(s) have wrong pii-notice text (CONTRACT §1.3):")
        for f in bad:
            fail(f"  {f}")
    else:
        scope = f"{scanned} touched page(s)" if changed is not None else f"{scanned} pages scanned across tools/ + chaingraph/workbench/ + chaingraph/canvas/"
        print(f"  ✅ PII text: {n} pii-notice divs all carry canonical §1.3 text ({scope})")


# ── Check 2: Manifest coverage ────────────────────────────────────────────────
def check_manifests(changed=None):
    tools = _touched(sorted(TOOLS.glob("*.html")), changed)
    missing = []
    for path in tools:
        stem = path.stem
        if not (MANIFESTS / f"{stem}.manifest.json").exists():
            missing.append(path.name)
    if missing:
        fail(f"[MANIFEST] {len(missing)} tool(s) have no .manifest.json:")
        for f in missing:
            fail(f"  {f}")
    else:
        scope = f"{len(tools)} touched tool(s)" if changed is not None else f"all {len(tools)} tools"
        print(f"  ✅ Manifests: {scope} have a .manifest.json")


# ── Check 3: AP2 consistency ──────────────────────────────────────────────────
def check_ap2(changed=None):
    manifests = _touched(sorted(MANIFESTS.glob("*.manifest.json")), changed)
    if changed is not None:
        # A tool's export button can drift out of sync with an unchanged manifest,
        # so also re-check any touched tool whose manifest declares ap2_export:true.
        touched_tool_stems = {p.stem for p in _touched(sorted(TOOLS.glob("*.html")), changed)}
        for stem in touched_tool_stems:
            mp = MANIFESTS / f"{stem}.manifest.json"
            if mp.exists() and mp not in manifests:
                manifests.append(mp)
    mismatches = []
    checked = 0
    for mfst_path in manifests:
        try:
            mfst = json.loads(mfst_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not mfst.get("ap2_export"):
            continue
        checked += 1
        stem = mfst_path.name.replace(".manifest.json", "")
        tool_path = TOOLS / f"{stem}.html"
        if not tool_path.exists():
            continue  # orphaned manifest — covered by parity step in CI
        text = tool_path.read_text(encoding="utf-8", errors="replace")
        if 'id="ap2ExportBtn"' not in text:
            mismatches.append(tool_path.name)
    if mismatches:
        fail(f"[AP2] {len(mismatches)} tool(s) declare ap2_export:true but lack the export button:")
        for f in mismatches:
            fail(f"  {f}")
    else:
        scope = f"{checked} touched ap2_export:true manifest(s)" if changed is not None else f"all {checked} ap2_export:true manifests"
        print(f"  ✅ AP2 consistency: {scope} have the button")


# ── Check 4: Sitemap coverage ─────────────────────────────────────────────────
# Directory scope is scripts/published-dirs.json — the SAME manifest
# scripts/regen-sitemap.mjs reads, so the generator and this gate can never
# scope-drift apart independently (DISCOVER-1 §D-2).
PUBLISHED_DIRS = json.loads((REPO / "scripts" / "published-dirs.json").read_text(encoding="utf-8"))


def _walk_html(dir_path, exclude_rel_prefixes):
    for p in sorted(dir_path.rglob("*.html")):
        rel = str(p.relative_to(REPO)).replace("\\", "/")
        if any(rel.startswith(ex + "/") for ex in exclude_rel_prefixes):
            continue
        yield p


def check_sitemap(changed=None):
    if not SITEMAP.exists():
        fail("[SITEMAP] sitemap.xml not found")
        return

    sitemap_locs = set(
        re.findall(r"<loc>https://ainumbers\.co/([^<]+)</loc>",
                   SITEMAP.read_text(encoding="utf-8"))
    )

    missing = []

    for dname in PUBLISHED_DIRS["flatDirs"]:
        d = REPO / dname
        for path in _touched(sorted(d.glob("*.html")), changed):
            if dname in ("tools", "guides"):
                content = path.read_text(encoding="utf-8", errors="replace")
                if dname == "guides" and "noindex" in content:
                    continue  # redirect stubs don't belong in sitemap
            if f"{dname}/{path.name}" not in sitemap_locs:
                missing.append(f"{dname}/{path.name}")

    for dname in PUBLISHED_DIRS["recursiveDirs"]:
        d = REPO / dname
        exclude = [ex for ex in PUBLISHED_DIRS.get("recursiveExcludeSubdirs", []) if ex.startswith(dname + "/")]
        for path in _touched(list(_walk_html(d, exclude)), changed):
            rel = str(path.relative_to(REPO)).replace("\\", "/")
            if rel not in sitemap_locs:
                missing.append(rel)

    if missing:
        fail(f"[SITEMAP] {len(missing)} file(s) missing from sitemap.xml:")
        for f in missing[:25]:
            fail(f"  {f}")
        if len(missing) > 25:
            fail(f"  ... and {len(missing) - 25} more — run: node scripts/regen-sitemap.mjs")
    else:
        dirs_checked = ", ".join(PUBLISHED_DIRS["flatDirs"] + PUBLISHED_DIRS["recursiveDirs"])
        scope = "touched pages" if changed is not None else "all pages"
        print(f"  ✅ Sitemap: {scope} present ({dirs_checked})")


# ── Check 5: Node hash + syntax gates ─────────────────────────────────────────
def _hash_relevant(changed):
    """True if any touched path could affect kernel hash/syntax integrity.
    These Node scripts scan every live kernel regardless of git diff, so skipping
    them is only safe when nothing they cover moved."""
    if changed is None:
        return True
    prefixes = ("chaingraph/kernels/", "chaingraph/standard/", "tools/", "manifests/",
                "chaingraph.json", "scripts/verify_repo.py")
    return any(f.startswith(prefixes) or f in ("chaingraph.json",) for f in changed)


def check_hash_gates(changed=None):
    if changed is not None and not _hash_relevant(changed):
        print("  ⏭️  Hash/syntax gates: no kernel/tool/manifest changes touched — skipped (CI runs the full scan)")
        return
    node = shutil.which("node")
    if not node:
        # Soft-skip when Node is absent (e.g. a Python-only checkout). CI installs
        # Node, so the gates are still enforced there. Do not block on missing tooling.
        print("  ⚠️  node not found — skipping hash/syntax gates locally (CI enforces them)")
        return
    for label, script in HASH_GATES:
        path = KERNELS / script
        if not path.exists():
            fail(f"[HASH] gate script missing: chaingraph/kernels/{script}")
            continue
        res = subprocess.run([node, str(path)], cwd=str(REPO), capture_output=True, text=True)
        if res.returncode != 0:
            fail(f"[HASH] {label} gate failed — `node chaingraph/kernels/{script}`:")
            tail = (res.stdout + res.stderr).strip().splitlines()[-12:]
            for line in tail:
                fail(f"    {line}")
        else:
            print(f"  ✅ {label}: passed")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--changed", metavar="REF",
                         help="incremental mode: scope checks to files touched vs REF "
                              "(e.g. origin/main). CI never passes this — full scan stays the default.")
    args = parser.parse_args()

    changed = get_changed_files(args.changed) if args.changed else None
    if not args.changed:
        mode = "full estate"
    elif changed is None:
        mode = f"git failed, full scan (--changed {args.changed} requested)"
    elif len(changed) == 0:
        mode = f"incremental vs {args.changed} — no changes"
    else:
        mode = f"incremental vs {args.changed} — scanned {len(changed)} changed file(s)"
    print(f"\n=== verify_repo.py — deploy gate ({mode}) ===\n")

    check_pii_text(changed)
    check_manifests(changed)
    check_ap2(changed)
    check_sitemap(changed)
    check_hash_gates(changed)

    if errors:
        print(f"\n❌  FAILED — {len(errors)} error(s) block deploy:\n")
        for e in errors:
            print(e)
        print()
        sys.exit(1)
    else:
        print(f"\n✅  All checks passed — safe to deploy")
        sys.exit(0)


if __name__ == "__main__":
    main()
