#!/usr/bin/env python3
"""
verify_repo.py — S1 deploy gate (hard gate — exits 1 on failure)

Five checks, all hard failures that block deploy:
  1. PII text correctness  — any pii-notice div must have canonical §1.3 text
  2. Manifest coverage     — every tools/*.html must have a .manifest.json
  3. AP2 consistency       — manifests with ap2_export:true must have the button in HTML
  4. Sitemap coverage      — every tools/*.html and guides/*.html in sitemap.xml
  5. Hash + syntax gates   — Node: JS syntax parse, forbidden-hash lint, golden
                             execution_hash parity, art-01 canonicalizer self-test
                             (soft-skips only if Node is absent; CI always enforces)

Usage:
  python scripts/verify_repo.py   # exits 0 (pass) or 1 (fail)
"""

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

# Node-based gates (OpenChainGraph hash integrity + JS syntax). Each exits non-zero on failure.
HASH_GATES = [
    ("JS syntax",            "syntax-check.mjs"),        # every inline classic script parses
    ("forbidden-hash lint",  "lint-forbidden-hash.mjs"), # no array-replacer / fake simpleHash
    ("golden parity",        "golden-parity.test.mjs"),  # pinned execution_hash drift
    ("art-01 kernel parity", "parity-art-01.test.mjs"),  # canonicalizer self-test
    ("kernel contract",      "kernel-contract.test.mjs"),# every kernel ships a fixture + buildArtifact is self-consistent (live hash_valid)
]

# CONTRACT §1.3 canonical PII text prefix (enough to confirm correct wording)
CANON_PII_PREFIX = (
    "\U0001f512 All inputs are processed locally in your browser. "
    "No data is transmitted."
)

errors = []


def fail(msg):
    errors.append(msg)


# ── Check 1: PII text correctness ─────────────────────────────────────────────
def check_pii_text():
    bad = []
    for path in sorted(TOOLS.glob("*.html")):
        text = path.read_text(encoding="utf-8", errors="replace")
        m = re.search(r'<div\s+class="pii-notice">(.*?)</div>', text, re.S)
        if m and CANON_PII_PREFIX not in m.group(1):
            bad.append(path.name)
    if bad:
        fail(f"[PII] {len(bad)} tool(s) have wrong pii-notice text (CONTRACT §1.3):")
        for f in bad:
            fail(f"  {f}")
    else:
        n = sum(
            1 for p in TOOLS.glob("*.html")
            if 'class="pii-notice"' in p.read_text(encoding="utf-8", errors="replace")
        )
        print(f"  ✅ PII text: {n} pii-notice divs all carry canonical §1.3 text")


# ── Check 2: Manifest coverage ────────────────────────────────────────────────
def check_manifests():
    missing = []
    for path in sorted(TOOLS.glob("*.html")):
        stem = path.stem
        if not (MANIFESTS / f"{stem}.manifest.json").exists():
            missing.append(path.name)
    if missing:
        fail(f"[MANIFEST] {len(missing)} tool(s) have no .manifest.json:")
        for f in missing:
            fail(f"  {f}")
    else:
        print(f"  ✅ Manifests: all {len(list(TOOLS.glob('*.html')))} tools have a .manifest.json")


# ── Check 3: AP2 consistency ──────────────────────────────────────────────────
def check_ap2():
    mismatches = []
    for mfst_path in sorted(MANIFESTS.glob("*.manifest.json")):
        try:
            mfst = json.loads(mfst_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not mfst.get("ap2_export"):
            continue
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
        ap2_count = sum(
            1 for p in MANIFESTS.glob("*.manifest.json")
            if json.loads(p.read_text(encoding="utf-8")).get("ap2_export")
        )
        print(f"  ✅ AP2 consistency: all {ap2_count} ap2_export:true manifests have the button")


# ── Check 4: Sitemap coverage ─────────────────────────────────────────────────
def check_sitemap():
    if not SITEMAP.exists():
        fail("[SITEMAP] sitemap.xml not found")
        return

    sitemap_locs = set(
        re.findall(r"<loc>https://ainumbers\.co/([^<]+)</loc>",
                   SITEMAP.read_text(encoding="utf-8"))
    )

    missing = []
    for path in sorted(TOOLS.glob("*.html")):
        if f"tools/{path.name}" not in sitemap_locs:
            missing.append(f"tools/{path.name}")
    for path in sorted(GUIDES.glob("*.html")):
        if path.name == "tool-chains.html":
            continue  # lives in core-pages block, not auto-generated section
        if f"guides/{path.name}" not in sitemap_locs:
            missing.append(f"guides/{path.name}")

    if missing:
        fail(f"[SITEMAP] {len(missing)} file(s) missing from sitemap.xml:")
        for f in missing[:25]:
            fail(f"  {f}")
        if len(missing) > 25:
            fail(f"  ... and {len(missing) - 25} more — run: python scripts/regen_sitemap.py --apply")
    else:
        t = len(list(TOOLS.glob("*.html")))
        g = len([p for p in GUIDES.glob("*.html") if p.name != "tool-chains.html"])
        print(f"  ✅ Sitemap: all {t} tools + {g} guides present")


# ── Check 5: Node hash + syntax gates ─────────────────────────────────────────
def check_hash_gates():
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
    print("\n=== verify_repo.py — deploy gate ===\n")
    check_pii_text()
    check_manifests()
    check_ap2()
    check_sitemap()
    check_hash_gates()

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
