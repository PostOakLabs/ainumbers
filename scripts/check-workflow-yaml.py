#!/usr/bin/env python3
"""check-workflow-yaml.py — every .github/workflows/*.yml must PARSE and carry `on` + `jobs`.

Why this exists (measured 2026-08-16): derived-artifacts-regen.yml shipped with three
unindented continuation lines inside a `run: |` block. The file did not parse, so GitHub
could not evaluate its `branches: [main]` filter and emitted a zero-job FAILURE run on
EVERY push to EVERY branch — eleven red emails in three hours, none of them about the
branch being pushed. Nothing in preflight parsed workflow YAML, so it was invisible locally.

Exit 0 when every workflow parses; exit 1 naming the file, line, and column otherwise.
A missing PyYAML is a hard error, not a skip — a gate that skips is theatre.
"""
import glob
import os
import sys

# Windows consoles default to cp1252; force UTF-8 so ✓/✗ never crash the gate itself.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    import yaml
except ImportError:  # pragma: no cover
    print("✗ check-workflow-yaml: PyYAML not importable — install python3-yaml; this gate does not skip.")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml")) +
               glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yaml")))

if not files:
    print("✗ check-workflow-yaml: no workflow files found under .github/workflows/ — positive control absent.")
    sys.exit(1)

bad = 0
for path in files:
    rel = os.path.relpath(path, ROOT).replace("\\", "/")
    try:
        with open(path, encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
    except yaml.YAMLError as exc:  # parse failure — the derived-artifacts-regen class
        mark = getattr(exc, "problem_mark", None)
        where = f" line {mark.line + 1}, col {mark.column + 1}" if mark else ""
        print(f"✗ {rel}: YAML does not parse{where}: {getattr(exc, 'problem', exc)}")
        bad += 1
        continue
    if not isinstance(doc, dict):
        print(f"✗ {rel}: top level is not a mapping")
        bad += 1
        continue
    # PyYAML 1.1 reads a bare `on:` key as boolean True.
    has_on = ("on" in doc) or (True in doc)
    if not has_on or "jobs" not in doc:
        print(f"✗ {rel}: missing required top-level key(s): "
              + ", ".join(k for k, ok in (("on", has_on), ("jobs", "jobs" in doc)) if not ok))
        bad += 1
        continue
    if not isinstance(doc["jobs"], dict) or not doc["jobs"]:
        print(f"✗ {rel}: `jobs` is empty or not a mapping")
        bad += 1

if bad:
    print(f"✗ check-workflow-yaml: {bad} of {len(files)} workflow file(s) invalid.")
    sys.exit(1)
print(f"✓ check-workflow-yaml: {len(files)} workflow file(s) parse with `on` + `jobs`.")
