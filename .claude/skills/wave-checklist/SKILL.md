---
name: wave-checklist
description: Build workflow, wave completion checklist and current-scale commands for this repo. Use when building a tool, finishing a wave, adding tools or chains, or before every push.
---

# Build workflow and wave completion checklist

Moved here from `repo/CLAUDE.md` so it loads only when invoked. `CONTRACT.md` stays the SSOT.

## Build Workflow

1. Read `CONTRACT.md` §0-§6 (normative rules). `CONTRACT-RATIONALE.md` carries the same sections' explanatory prose and audit history and is optional.
2. Generate a single `.html` file and place it in `tools/`.
3. Validate Policy Mandate schema (`CONTRACT.md` §3.1), storage, and export contracts before output.
4. Run the pre-flight checklist from `CONTRACT.md` §6.1.
5. Add a card entry to the `index.html` tool grid (correct `data-cat`, `data-tags`, `data-name`).
6. Update the category tool count in `index.html` cat-heading `<span class="cat-n">`.
7. `sitemap.xml`: SKIP. It is a shared derived artifact with a single writer: `derived-artifacts-regen.yml` regenerates and commits it on `main` after every merge. A PR never edits it (two branches editing the same generated file independently caused the merge-ref skew this convention exists to prevent).

## Wave Completion Checklist

**BEFORE EVERY PUSH: `node scripts/preflight.mjs`.** It runs every hard CI gate locally, in CI order (JS syntax, hash gates, index-sync, dead-link, count-drift, hub freshness, SSOT conformance, verify_repo, mfstSec). Green here means green in CI. Never push on a red preflight. The numbered items below are the individual remediation steps when a gate fails.

**Mechanical enforcement:** a committed `pre-push` hook (`.githooks/pre-push`) runs `preflight.mjs` on every push. Enable it once per clone with `node scripts/setup-hooks.mjs` (sets `core.hooksPath = .githooks`; worktrees inherit it). Emergency bypass: `git push --no-verify`. CI stays the real backstop.

Run after every batch of new tools/chains, before committing:

0. **JS syntax gate (BLOCKING)** - `node scripts/check_tools.js` MUST print `0 ... syntax error` and exit 0. If red, `node scripts/locate_errors.js` to find the break, fix, re-run. Never commit tool HTML on a red gate. (CONTRACT §6.2.)
0b. **Hub freshness** - `chaingraph/chaingraph-hub.html` is a shared derived artifact with a single writer. Do NOT run `gen-chain-index.mjs` and commit it in your PR; `derived-artifacts-regen.yml` regenerates it on `main` after merge. `node scripts/gen-chain-index.mjs --check` downgrades to advisory on a `pull_request` and stays blocking on `main` and on `merge_group` (the queue's CI job assembles the derived tree ephemerally into `DERIVED_ROOT`). A red PR-side result means main has not caught up, not that you owe a fix.
1. **Manifests** - one per new tool: `manifests/{number}-{slug}.manifest.json`. No short-form `{number}-manifest.json` variants.
2. **Catalog** - `mcp/catalog.json`, `mcp/server.json`, `.well-known/mcp.json`, `llms.txt`, `tools.html`, and `index.html` are shared derived artifacts with a single writer. Do NOT run or commit `regen_catalog.py` in your PR; `derived-artifacts-regen.yml` runs it on `main` after merge. `docs/catalog.json` is a copy of `mcp/catalog.json` written later by `scripts/gen-openapi.mjs` (also main-side). The freshness gate `python scripts/check_index_sync.py --strict --no-color` downgrades to advisory on a `pull_request` and stays blocking on `main` and on `merge_group`.
3. **Sitemap** - `sitemap.xml` is a shared derived artifact with a single writer. Do NOT run or commit `node scripts/regen-sitemap.mjs` in your PR; `derived-artifacts-regen.yml` runs it on `main` after merge, scanning every directory in `scripts/published-dirs.json` (shared with `scripts/verify_repo.py`'s `check_sitemap`). Gate `node scripts/regen-sitemap.mjs --check` downgrades to advisory on a `pull_request`, stays blocking on `main` and on `merge_group`. Not `scripts/regen_sitemap.py` (quarantined as `.DEPRECATED`: it knew only `tools/`, `guides/`, `chaingraph/` plus seven hardcoded root pages and turned the freshness gate red).
4. **PII banners** - every new tool must carry the exact CONTRACT §1.3 sentence in its rendered text. Verify: `node scripts/check-pii-banner.mjs` (also in preflight; a CSS/JS-only mention of the class name does not satisfy it, the check reads rendered text).
5. **Policy Mandate export** - tools whose title/function involves policy, rule, mandate, routing, compliance, risk, AML, or KYC must have the Policy Mandate export button, element id `ap2ExportBtn` (retained legacy id, §3.1, do not rename). Check each new in-scope tool.
6. **index.html** - card entry present with correct `data-cat`, `data-tags`, `data-name`, and updated `<span class="cat-n">` count.
7. **Stat sync** - `mcp.html` / `chaingraph/chaingraph-hub.html` workflow/tool-count fallbacks are shared derived artifacts with a single writer. Do NOT run `--fix` and commit it in your PR; `derived-artifacts-regen.yml` runs it on `main` after merge. `node scripts/sync-stats.mjs` (no flag) downgrades to advisory on a `pull_request`, stays blocking on `main` and on `merge_group`.
8. **Count-drift gate** - every published count sentinel (`<!--COUNT:key-->N<!--/COUNT-->`, `data-count="key"`) is a shared derived artifact with a single writer. Do NOT run `--fix` and commit it in your PR; `derived-artifacts-regen.yml` runs it on `main` after merge. `node scripts/verify-counts.mjs --check` downgrades to advisory on a `pull_request`, stays blocking on `main` and on `merge_group`. Never hardcode a count to make this pass: fix the sentinel or the source.

## Current Scale

Always verify with `ls`; counts update with every new tool:
```bash
ls tools/*.html | wc -l      # tools
ls guides/*.html | wc -l     # hubs
ls manifests/*.manifest.json | grep -v "DELETE ME" | wc -l  # manifests
```

**Hard Stop:** if any constraint conflicts with legacy specs, follow `CONTRACT.md`.

## Additional rules (post-launch audits)

- **Manifest naming:** one file per tool, always `{number}-{slug}.manifest.json`. Never short-form `{number}-manifest.json` variants (they become orphans).
- **JSON-LD schema block** is required on every hub page (see `CONTRACT.md` §6.3).
