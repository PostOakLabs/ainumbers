# CLAUDE.md — repo/ Build Directive

> Scoped to the deployable code in this folder. For workspace layout, git workflow, and project context read `../CLAUDE.md` first.

**Role:** Deterministic, privacy-first fintech web engineer.

**SSOT:** `CONTRACT.md` — read in full before generating, modifying, or validating any file.

## 🗂️ Repository Structure

```
ainumbers/
├── CONTRACT.md        ← SSOT — read before any build
├── index.html         ← Main dashboard (tool grid, category filters, search)
├── sitemap.html / contact.html / about.html
├── tools/             ← standalone tool HTML files (numbered, pf-, rbe-, named)
├── guides/            ← integration hub HTML files (*-hub.html)
├── manifests/         ← MCP tool manifests (one per tool)
├── sitemap.xml / robots.txt / llms.txt
```

**Canonical tool template:** `tools/152-baas-provider-comparator.html`  
**Canonical manifest template:** `manifests/01-a2a-fee-route-optimizer.manifest.json`

## 🔒 Non-Negotiable Constraints

- **Single self-contained `.html` per tool.** Inline CSS/JS only. Google Fonts (`DM Serif Display`, `Sora`, `JetBrains Mono`) only.
- **Zero network calls.** No `fetch`, `async`, `WebWorker`, external APIs, or CDNs after page load.
- **Zero PII.** No storage, logging, or transmission of personal/identifiable data.
- **Storage:** All client storage forbidden — `sessionStorage`, `localStorage`, `cookies`, `IndexedDB`. All state is in-memory. (`ain_lang` sessionStorage exemption removed — lang toggle deferred; see `CONTRACT.md` §1.1.)
- **Routing:** Tools in `tools/` must use `../` relative paths to reach root assets. Index uses `tools/` and `guides/` prefixes for all internal links. Absolute URLs reserved strictly for `suite-registry.json` & external MCP endpoints.
- **License:** CC BY 4.0. Code must be readable, commented, and attribution-ready.

## 🤖 MCP / tool-registration invariants (CONTRACT §A4 — MUST)

> **SSOT for the OpenChainGraph standard = `repo/chaingraph/standard/SPEC.md`** (+ `openchain-graph-v0.4.schema.json`). Build rules live in `CONTRACT.md`. "v0.4-compliant" = passes the SPEC.md §15 gate suite (Amendment A5) — cite SPEC.md section numbers, don't restate the envelope/hash/taxonomy. Run the SSOT gates before any push that touches `chaingraph.json`, spec/hub HTML, `standard/`, or a kernel: `node chaingraph/standard/{schema-validate,spec-version-consistency,spec-gate-coverage}.mjs`.

Before adding or renaming any tool, ChainGraph node, chain, or kernel:
- **Unique `mcp_name`** across live `chaingraph.json` nodes + PILOT widgets + the 6 utility tools — a duplicate 500s the live `/mcp` handshake. Check: `node ../mcp-apps-poc/scripts/check-tool-names.mjs`.
- **Canonical `execution_hash` only** via the shared `chaingraph/kernels/_hash.mjs` (real WebCrypto SHA-256 over RFC 8785/JCS `{policy_parameters, output_payload}`). Forbidden: array-replacer canon (`JSON.stringify(x, Object.keys(x).sort())`), `simpleHash`/fake `sha256:`, hashing a reduced payload. Gates: `chaingraph/kernels/{lint-forbidden-hash,golden-parity,parity-art-01,syntax-check}.mjs`.
- **The MCP worker is a separate repo (`mcp-apps-poc/`) that boots from generated `data/` + `kernels/`.** After changing `chaingraph.json`/manifests/kernels, run `node generate.mjs` there and commit `data/` + `kernels/` in the SAME push (generate.mjs can't run in the cloud build). Deploy is gated GitHub Actions only (Workers Builds stays disconnected); confirm the post-deploy `/mcp` smoke step. Full detail: `CONTRACT.md` §A4.

## 📐 Required UI & Export Contracts

- **Lang toggle:** OMIT. Do not add `.lang-bar`, `setLang()`, or `TRANSLATIONS` objects. Toggle deferred — see `CONTRACT.md` §1.1 and `../I18N-SPEC.md` for future re-implementation spec.
- **AP2 Button:** Must live in `.results-export-row`. Validates against AP2 v1.0 schema before download.
- **Export Tiers:** Tier 1 (AP2 JSON + Markdown) mandatory for all policy/rule/mandate tools. Tier 2/3 conditional.
- **PII Banner:** Exact text: `🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.`

## 🛠️ Build Workflow

1. Read `CONTRACT.md` §0–§6 fully.
2. Generate single `.html` file and place it in `tools/`.
3. Validate AP2 schema, storage, and export contracts before output.
4. Run pre-flight checklist from `CONTRACT.md` §6.1.
5. Add card entry to `index.html` tool grid (correct `data-cat`, `data-tags`, `data-name`).
6. Update category tool count in `index.html` cat-heading `<span class="cat-n">`.
7. Add `<url>` entry to `sitemap.xml` under `<!-- Tools -->`.

## ✅ Wave Completion Checklist

Run after every batch of new tools, before committing:

0. **JS syntax gate (BLOCKING)** — `node scripts/check_tools.js` MUST print `0 ... syntax error` and exit 0. If red, `node scripts/locate_errors.js` to find the break, fix, re-run. **Never commit tool HTML on a red gate.** (CONTRACT §6.2.)
1. **Manifests** — one per new tool: `manifests/{number}-{slug}.manifest.json`. No short-form `{number}-manifest.json` variants.
2. **Catalog** — `python scripts/regen_catalog.py` — regenerates `catalog.json` + `data/catalog.json`.
3. **Sitemap** — `python scripts/regen_sitemap.py --apply` — regenerates `sitemap.xml` from filesystem.
4. **PII banners** — every new tool must have the canonical `<div class="pii-notice">` with exact CONTRACT §1.3 text. Verify: `grep -rL "pii-notice" tools/*.html` (expect: no output).
5. **AP2 export** — tools whose title/function involves policy, rule, mandate, routing, compliance, risk, AML, or KYC must have `id="ap2ExportBtn"`. Check each new in-scope tool.
6. **index.html** — card entry present with correct `data-cat`, `data-tags`, `data-name`, and updated `<span class="cat-n">` count.

## 📊 Current Scale

Always verify with `ls` — counts update with every new tool:
```bash
ls tools/*.html | wc -l      # tools
ls guides/*.html | wc -l     # hubs
ls manifests/*.manifest.json | grep -v "DELETE ME" | wc -l  # manifests
```
Run `ls` to verify — counts change each session.

**Hard Stop:** If any constraint conflicts with legacy specs, follow `CONTRACT.md`.

## 📋 Additional Rules (from post-launch audits)

- **AP2 is mandatory** for any tool whose title/function involves: policy, rule, mandate, routing, compliance, risk assessment, AML, KYC, or gap analysis. When in doubt, add it.
- **Manifest naming:** one file per tool, always `{number}-{slug}.manifest.json`. Never create short-form `{number}-manifest.json` variants — these become orphans.
- **No external JS libraries** for export (no jsPDF, no SheetJS, etc.) unless explicitly bundled inline. Use `URL.createObjectURL(new Blob(...))` + `<a download>` only.
- **`<link rel="canonical">`** uses absolute URLs intentionally — this is correct SEO practice, not a routing violation.
- **JSON-LD schema block** is required on every hub page (see `CONTRACT.md` §6.3).
- **index.html is 5 500+ lines** — high truncation risk in any AI context window. Edit surgically with grep + line numbers rather than reading the whole file.
