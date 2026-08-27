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
                             execution_hash parity, art-01 canonicalizer self-test,
                             kernel contract (--strict: a registered kernel with no
                             fixture is a FAILURE, not a warning — see HASH_GATES),
                             kernel hash integrity
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
import os
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
# Entries are (label, script) or (label, script, [extra CLI args]).
#
# ⛔ KERNEL-CONTRACT-STRICT-1 (2026-08-23, gate-integrity wave) — WHY `--strict` IS NOT OPTIONAL HERE.
# The two kernel gates below are each other's fallback, and before this flag they fell back to NOBODY:
#   • kernel-hash-integrity.mjs probes every live gpu:false kernel with a DEFAULT `{}` input. A kernel
#     that THROWS on that probe is input-sensitive, so the gate cannot judge it: it files the kernel
#     under `unprobeable`, prints "⚠ … add a fixtures/<id>.fixtures.json so kernel-contract can verify",
#     and exits 0. That deferral is correct — it names kernel-contract as the verifier.
#   • kernel-contract.test.mjs WITHOUT `--strict` treats a kernel with NO fixture as a warning and
#     exits 0 too. So the gate the deferral pointed at also declined to judge it.
# ⇒ A kernel that both probe-crashes AND ships no fixture was verified by NEITHER gate, while BOTH
# printed a green line and BOTH exited 0. Nothing downstream ever converted either warning into a
# failure. That is SO #34c at the kernel boundary — absence of a result is a DISTINCT state, never a
# green one — and it is the same silent-green shape as the deletable ratchet baseline (F-11,
# RATCHET-BASELINE-LOADER-1): the control did not fail, it stopped existing, and its output read fine.
# `--strict` closes it by making "no fixture at all" a NAMED failure, so kernel-hash-integrity's
# deferral now lands on a gate that actually judges. ⛔ Do not drop this flag to make a kernel pass —
# the fix for a newly-named kernel is a fixture (or, for an OCG §25 private-input node, the
# private_input_profile exemption the contract test already honours), never a lenient invocation.
HASH_GATES = [
    ("JS syntax",            "syntax-check.mjs"),        # every inline classic script parses
    ("forbidden-hash lint",  "lint-forbidden-hash.mjs"), # no array-replacer / fake simpleHash
    ("golden parity",        "golden-parity.test.mjs"),  # pinned execution_hash drift
    ("art-01 kernel parity", "parity-art-01.test.mjs"),  # canonicalizer self-test
    ("kernel contract",      "kernel-contract.test.mjs", ["--strict"]),
                                                        # every kernel ships a fixture + buildArtifact is self-consistent (live hash_valid);
                                                        # --strict makes the missing-fixture case a failure, not a warning (see above)
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


# ── git child environment (GIT-ENV-LEAK-SWEEP-1, 2026-08-23) ───────────────────
# THE PYTHON HALF of scripts/_git-env-lib.mjs's gitEnv(). Python cannot import an .mjs module, so
# this is the one sanctioned second copy in the estate — scripts/check-git-env-scrub.mjs names this
# file explicitly for that reason, and a THIRD copy in any language reds that gate.
#
# Why it is needed at all: git exports GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE into the environment
# of every hook it runs, and this module is reached from scripts/preflight.mjs, which .githooks/
# pre-push invokes from inside `git push`. Those variables BEAT `cwd` in git's repository discovery,
# so without the scrub `get_changed_files` would return the OUTER repository's changed files and
# verify_repo would check a set of paths that has nothing to do with the tree it is verifying.
# Deleting every key with a GIT_ prefix (not a list of remembered names) excludes the next one too.
def _git_env():
    return {k: v for k, v in os.environ.items() if not k.upper().startswith("GIT_")}


# ── --changed support ──────────────────────────────────────────────────────────
def get_changed_files(ref):
    """Union of files touched vs <ref> (committed) and in the working tree (uncommitted).
    Returns None if git or <ref> is unavailable — caller falls back to a full scan."""
    if not shutil.which("git"):
        return None
    try:
        subprocess.run(["git", "rev-parse", "--verify", ref],
                        cwd=str(REPO), env=_git_env(), capture_output=True, text=True, check=True)
    except Exception:
        print(f"  ⚠️  --changed {ref}: ref not resolvable — falling back to full scan")
        return None
    changed = set()
    for cmd in (["git", "diff", "--name-only", f"{ref}...HEAD"],
                ["git", "diff", "--name-only", "HEAD"],
                ["git", "status", "--porcelain"]):
        res = subprocess.run(cmd, cwd=str(REPO), env=_git_env(), capture_output=True, text=True)
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
# Two directions, both hard-gated (AP2-MANIFEST-PARITY-1):
#   forward  — manifest ap2_export:true  ⇒ tools/*.html has id="ap2ExportBtn"
#   inverse  — tools/*.html has id="ap2ExportBtn" ⇒ manifest ap2_export:true
# The forward direction alone let 8 tool/manifest pairs drift silently (button
# shipped, manifest never flipped) — the ONLY way that class regrows is caught
# is if BOTH directions are hard gates. A node-keyed manifest with no tools/
# page (34 in the live estate, e.g. `520-c2pa-manifest-validator`) is exempt
# from the inverse direction by construction: the inverse walk starts from
# tools/*.html, so a manifest with no corresponding HTML page is never visited.
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
    fwd_mismatches = []
    fwd_checked = 0
    for mfst_path in manifests:
        try:
            mfst = json.loads(mfst_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not mfst.get("ap2_export"):
            continue
        fwd_checked += 1
        stem = mfst_path.name.replace(".manifest.json", "")
        tool_path = TOOLS / f"{stem}.html"
        if not tool_path.exists():
            continue  # orphaned manifest — covered by parity step in CI
        text = tool_path.read_text(encoding="utf-8", errors="replace")
        if 'id="ap2ExportBtn"' not in text:
            fwd_mismatches.append(tool_path.name)
    if fwd_mismatches:
        fail(f"[AP2] {len(fwd_mismatches)} tool(s) declare ap2_export:true but lack the export button:")
        for f in fwd_mismatches:
            fail(f"  {f}")
    else:
        scope = f"{fwd_checked} touched ap2_export:true manifest(s)" if changed is not None else f"all {fwd_checked} ap2_export:true manifests"
        print(f"  ✅ AP2 consistency (forward — manifest⇒button): {scope} have the button")

    # ── Inverse direction: button present ⇒ manifest ap2_export:true ──────
    tools = _touched(sorted(TOOLS.glob("*.html")), changed)
    inv_mismatches = []
    inv_checked = 0
    for tool_path in tools:
        text = tool_path.read_text(encoding="utf-8", errors="replace")
        if 'id="ap2ExportBtn"' not in text:
            continue
        inv_checked += 1
        stem = tool_path.stem
        mfst_path = MANIFESTS / f"{stem}.manifest.json"
        if not mfst_path.exists():
            continue  # missing manifest entirely — covered by check_manifests()
        try:
            mfst = json.loads(mfst_path.read_text(encoding="utf-8"))
        except Exception:
            continue  # malformed JSON — not this check's concern
        if not mfst.get("ap2_export"):
            inv_mismatches.append(tool_path.name)
    if inv_mismatches:
        fail(f"[AP2] {len(inv_mismatches)} tool(s) carry the export button but manifest lacks ap2_export:true:")
        for f in inv_mismatches:
            fail(f"  {f}")
    else:
        scope = f"{inv_checked} touched button-bearing tool(s)" if changed is not None else f"all {inv_checked} button-bearing tools"
        print(f"  ✅ AP2 consistency (inverse — button⇒manifest): {scope} have ap2_export:true")


# ── Check 4: Sitemap coverage ─────────────────────────────────────────────────
# Directory scope is scripts/published-dirs.json — the SAME manifest
# scripts/regen-sitemap.mjs reads, so the generator and this gate can never
# scope-drift apart independently (DISCOVER-1 §D-2).
PUBLISHED_DIRS = json.loads((REPO / "scripts" / "published-dirs.json").read_text(encoding="utf-8"))

# ── STATUS FILTER (GENERATOR-STATUS-FILTER-1) ────────────────────────────────
# ⛔ SCOPE IS SHARED WITH THE GENERATOR, AND SO IS LIVENESS. The directory scope
# above already comes from one manifest so generator and gate cannot drift. The
# MEMBERSHIP rule had no such pairing: regen-sitemap.mjs now withholds the URL of
# a page whose node has LEFT SERVICE, while this gate still demanded that every
# .html file on disk appear in sitemap.xml. Two rules, opposite verdicts, same
# file — measured: with only the generator fixed, this gate failed with
# "[SITEMAP] 1 file(s) missing: chaingraph/art-99-….html" and the row's own
# requirement was unsatisfiable.
#
# The file legitimately stays: ART99-GHOST-CLEANUP-1 (PR #1501) kept art-99's
# page as a retirement-banner stub so a rebuilt successor can inherit the URL.
# ⇒ File presence is not publishability. Same shape as the `noindex` guides skip
# below, which this estate has accepted since DISCOVER-1.
#
# ⛔ The asymmetry matches scripts/_node-status.mjs exactly and deliberately:
# ONLY an explicit, non-"live" status withholds a page. A missing status, or a
# page with no node at all, is published as before — this filter can only ever
# subtract pages the graph NAMES as departed.
_NON_LIVE_PAGES_CACHE = None


def _non_live_page_paths():
    """Repo-relative page paths of nodes chaingraph.json declares NOT live."""
    global _NON_LIVE_PAGES_CACHE
    if _NON_LIVE_PAGES_CACHE is not None:
        return _NON_LIVE_PAGES_CACHE
    base = "https://ainumbers.co/"
    paths = set()
    try:
        cg = json.loads((REPO / "chaingraph" / "chaingraph.json").read_text(encoding="utf-8"))
    except Exception:
        # Unreadable graph -> filter NOTHING. This gate then behaves exactly as it
        # did before this change (every file must be listed), which is the strict
        # direction. A broken read must never quietly excuse a missing URL.
        _NON_LIVE_PAGES_CACHE = paths
        return paths
    for node in cg.get("nodes", []):
        status = node.get("status")
        if not isinstance(status, str) or status == "" or status == "live":
            continue
        url = node.get("url")
        if not isinstance(url, str) or not url.startswith(base):
            continue
        rel = url[len(base):].split("#")[0].split("?")[0]
        if rel:
            paths.add(rel)
    _NON_LIVE_PAGES_CACHE = paths
    return paths


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
    non_live = _non_live_page_paths()
    withheld = []

    for dname in PUBLISHED_DIRS["flatDirs"]:
        d = REPO / dname
        for path in _touched(sorted(d.glob("*.html")), changed):
            rel = f"{dname}/{path.name}"
            if rel in non_live:
                withheld.append(rel)   # node left service; the generator withholds the URL
                continue
            if dname in ("tools", "guides"):
                content = path.read_text(encoding="utf-8", errors="replace")
                if dname == "guides" and "noindex" in content:
                    continue  # redirect stubs don't belong in sitemap
            if rel not in sitemap_locs:
                missing.append(rel)

    for dname in PUBLISHED_DIRS["recursiveDirs"]:
        d = REPO / dname
        exclude = [ex for ex in PUBLISHED_DIRS.get("recursiveExcludeSubdirs", []) if ex.startswith(dname + "/")]
        for path in _touched(list(_walk_html(d, exclude)), changed):
            rel = str(path.relative_to(REPO)).replace("\\", "/")
            if rel in non_live:
                withheld.append(rel)   # node left service; the generator withholds the URL
                continue
            if rel not in sitemap_locs:
                missing.append(rel)

    # THE OTHER HALF OF THE SAME RULE, and it is the half that catches a
    # regression. A withheld page must be ABSENT from sitemap.xml, not merely
    # excused from being present — otherwise reverting the generator's status
    # filter would sail through this gate unnoticed.
    still_listed = sorted(p for p in withheld if p in sitemap_locs)
    if still_listed:
        fail(f"[SITEMAP] {len(still_listed)} departed page(s) still advertised in sitemap.xml:")
        for f in still_listed[:25]:
            fail(f"  {f} — node is not live; run: node scripts/regen-sitemap.mjs")

    if missing:
        fail(f"[SITEMAP] {len(missing)} file(s) missing from sitemap.xml:")
        for f in missing[:25]:
            fail(f"  {f}")
        if len(missing) > 25:
            fail(f"  ... and {len(missing) - 25} more — run: node scripts/regen-sitemap.mjs")
    elif still_listed:
        pass  # already failed above; do not print a green line over a red result
    else:
        dirs_checked = ", ".join(PUBLISHED_DIRS["flatDirs"] + PUBLISHED_DIRS["recursiveDirs"])
        scope = "touched pages" if changed is not None else "all pages"
        note = f"; {len(withheld)} withheld (node not live, file kept)" if withheld else ""
        print(f"  ✅ Sitemap: {scope} present ({dirs_checked}){note}")


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
    for label, script, *rest in HASH_GATES:
        gate_args = list(rest[0]) if rest else []
        path = KERNELS / script
        if not path.exists():
            fail(f"[HASH] gate script missing: chaingraph/kernels/{script}")
            continue
        res = subprocess.run([node, str(path), *gate_args], cwd=str(REPO), capture_output=True, text=True)
        if res.returncode != 0:
            # The reproduce command MUST carry the same args this gate ran with. A copied
            # command missing `--strict` re-runs the LENIENT gate and prints green over the
            # very failure being diagnosed — the defect class this row closed.
            shown = " ".join([f"node chaingraph/kernels/{script}", *gate_args])
            fail(f"[HASH] {label} gate failed — `{shown}`:")
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
