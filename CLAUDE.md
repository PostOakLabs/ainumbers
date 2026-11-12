# CLAUDE.md — repo/ Build Directive

> Scoped to the deployable code in this folder. For workspace layout, git workflow, and project context read `../CLAUDE.md` first.

**Role:** Deterministic, privacy-first fintech web engineer.

**SSOT:** `CONTRACT.md` - read §0–§6 before generating, modifying, or validating any file, plus the annex your row class names (map below). Amendments and appendices are read on demand, never skipped when named.
- tool page rows → §1, §3, §4, §6
- guide/hub rows → §1, §5, §6.3
- kernel / node-shard rows → §6, A3, A4 + the `execution_hash` rule below
- MCP worker / manifest rows → §2, A4
- chain rows → A3
- claim-register or evidence rows → A14, §15

**Moved out (load on demand):** build workflow, wave completion checklist and scale commands → skill `wave-checklist` (`.claude/skills/wave-checklist/SKILL.md`). Tool-HTML-only rules (lang toggle, Policy Mandate export, export tiers, PII banner) → `.claude/rules/tool-html.md` (loads when `tools/**/*.html` is touched).

**Layout:** `tools/` (standalone tool HTML), `guides/` (`*-hub.html`), `manifests/` (one per tool), `chaingraph/`, `index.html`, `CONTRACT.md`. Canonical templates: `tools/152-baas-provider-comparator.html`, `manifests/01-a2a-fee-route-optimizer.manifest.json`.

## 🔒 Non-Negotiable Constraints

- **Single self-contained `.html` per tool.** Inline CSS/JS only. Google Fonts (`DM Serif Display`, `Sora`, `JetBrains Mono`) only.
- **Zero network calls.** No `fetch`, `async`, `WebWorker`, external APIs, or CDNs after page load.
- **Zero PII.** No storage, logging, or transmission of personal/identifiable data.
- **Storage:** All client storage forbidden — `sessionStorage`, `localStorage`, `cookies`, `IndexedDB`. All state is in-memory (`CONTRACT.md` §1.1).
- **Routing:** Tools in `tools/` use `../` relative paths to reach root assets. Index uses `tools/` and `guides/` prefixes. Absolute URLs only for the MCP registry surfaces (`.well-known/mcp.json`, `mcp/catalog.json`, `mcp/server.json`) and external MCP endpoints.
- **License:** CC BY 4.0. Code readable, commented, attribution-ready.
- **Reader-facing copy (CONTRACT §1.4):** no em-dashes (en-dash ranges fine; §1.3 banner exempt) and no build codes (`Wave N`, `W-A`…`W-G`, `D0`) in public HTML prose or `chaingraph.json` descriptions. Gate: `node scripts/check-copy-hallmarks.mjs`; counts in its baseline only go down.
- **Author every code/data file with Write/Edit — NEVER a bash heredoc, `echo`, or `printf`** (quote/`$` mangling silently truncates files).
- **`execution_hash` — call `executionHash(policy_parameters, output_payload)` from `chaingraph/kernels/_hash.mjs`. NEVER hand-build the preimage or `JSON.stringify` it.** One canonicalization exists (RFC 8785 / JCS `cgCanon`). Ad-hoc canon trips `lint-forbidden-hash`; fix with `node chaingraph/kernels/fix-hash-scheme.mjs`. Copy the hash path from a proven kernel (e.g. `art-213`).
- **Derived artifacts: never edit in a PR.** `sitemap.xml`, `mcp/catalog.json`, `mcp/server.json`, `.well-known/mcp.json`, `llms.txt`, `tools.html`, `index.html` generated sections, `chaingraph/chaingraph-hub.html`, and count sentinels have a single writer (`derived-artifacts-regen.yml`, on `main`). Freshness gates are advisory on PRs; details in skill `wave-checklist`.

## 🤖 MCP / tool-registration invariants (CONTRACT §A4 — MUST)

> **SSOT for the OpenChainGraph standard = `chaingraph/standard/SPEC.md`** (+ `openchain-graph-v0.4.schema.json`). "v0.4-compliant" = passes the SPEC.md §15 gate suite (Amendment A5) — cite section numbers, don't restate. Before any push touching `chaingraph.json`, spec/hub HTML, `standard/`, or a kernel: `node chaingraph/standard/{schema-validate,spec-version-consistency,spec-gate-coverage}.mjs`.

Before adding or renaming any tool, node, chain, or kernel:
- **Unique `mcp_name`** across live `chaingraph.json` nodes + PILOT widgets + the 6 utility tools (a duplicate 500s the live `/mcp` handshake): `node ../mcp-apps-poc/scripts/check-tool-names.mjs`.
- **Canonical `execution_hash` only** (shared `_hash.mjs`). Forbidden: array-replacer canon, `simpleHash`/fake `sha256:`, hashing a reduced payload. Gates: `chaingraph/kernels/{lint-forbidden-hash,golden-parity.test,parity-art-01.test,syntax-check}.mjs`.
- **The MCP worker is a separate repo (`mcp-apps-poc/`) booting from generated `data/` + `kernels/`.** After changing `chaingraph.json`/manifests/kernels, run `node generate.mjs` there and commit `data/` + `kernels/` in the SAME push. Deploy is gated GitHub Actions only; confirm the post-deploy `/mcp` smoke step. Detail: `CONTRACT.md` §A4.

## ⚡ Before every push

`node scripts/preflight.mjs` (all hard CI gates, CI order). Never push on red. The pre-push hook runs it; enable once per clone with `node scripts/setup-hooks.mjs`. Remediation steps and the full checklist: skill `wave-checklist`.

**Hard Stop:** if any constraint conflicts with legacy specs, follow `CONTRACT.md`.
