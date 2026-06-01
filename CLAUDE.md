# CLAUDE.md — repo/ Build Directive

> Scoped to the deployable code in this folder. For workspace layout, git workflow, and project context read `../CLAUDE.md` first.

**Role:** Deterministic, privacy-first fintech web engineer.

**SSOT:** `CONTRACT.md` — read in full before generating, modifying, or validating any file.

## 🗂️ Repository Structure

```
ainumbers/
├── CONTRACT.md              ← SSOT — read before any build
├── index.html               ← Main dashboard (tool grid, category filters, search)
├── sitemap.html             ← Human-readable sitemap
├── contact.html             ← Contact page
├── about.html               ← About page
├── tools/                   ← 268 standalone tool HTML files
│   ├── 01-a2a-fee-route-optimizer.html
│   ├── pf-132-compound-interest-explorer.html
│   ├── rbe-01-smb-treasury-tax.html
│   └── … (all numbered, pf-, rbe-, and named tools)
├── guides/                  ← 25 integration hub HTML files
│   ├── open-banking-integration-hub.html
│   └── … (all *-hub.html files)
├── manifests/               ← 268 MCP tool manifests (one per tool)
├── sitemap.xml
├── robots.txt
├── llms.txt
└── TOOLS_INDEX.md
```

**Canonical tool template:** `tools/152-baas-provider-comparator.html`  
**Canonical manifest template:** `manifests/01-a2a-fee-route-optimizer.manifest.json`

## 🔒 Non-Negotiable Constraints

- **Single self-contained `.html` per tool.** Inline CSS/JS only. Google Fonts (`DM Serif Display`, `Sora`, `JetBrains Mono`) only.
- **Zero network calls.** No `fetch`, `async`, `WebWorker`, external APIs, or CDNs after page load.
- **Zero PII.** No storage, logging, or transmission of personal/identifiable data.
- **Storage:** `sessionStorage` permitted **only** for `ain_lang` UI preference. `localStorage`, cookies, `IndexedDB` strictly forbidden.
- **Routing:** Tools in `tools/` must use `../` relative paths to reach root assets. Index uses `tools/` and `guides/` prefixes for all internal links. Absolute URLs reserved strictly for `suite-registry.json` & external MCP endpoints.
- **License:** CC BY 4.0. Code must be readable, commented, and attribution-ready.

## 📐 Required UI & Export Contracts

- **i18n:** `.lang-bar` with `<button>` toggles (`EN ES FR AR PT 中文`). `<a>` toggles are deprecated.
- **AP2 Button:** Must live in `.results-export-row`. Validates against AP2 v1.0 schema before download.
- **Export Tiers:** Tier 1 (AP2 JSON + Markdown) mandatory for all policy/rule/mandate tools. Tier 2/3 conditional.
- **PII Banner:** Exact text: `🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.`

## 🛠️ Build Workflow

1. Read `CONTRACT.md` §0–§6 fully.
2. Generate single `.html` file and place it in `tools/`.
3. Validate AP2 schema, i18n, storage, and export contracts before output.
4. Run pre-flight checklist from `CONTRACT.md` §6.1.
5. Add card entry to `index.html` tool grid (correct `data-cat`, `data-tags`, `data-name`).
6. Update category tool count in `index.html` cat-heading `<span class="cat-n">`.
7. Add `<url>` entry to `sitemap.xml` under `<!-- Tools -->`.

## 📊 Current Scale

Always verify with `ls` — counts update with every new tool:
```bash
ls tools/*.html | wc -l      # tools
ls guides/*.html | wc -l     # hubs
ls manifests/*.manifest.json | grep -v "DELETE ME" | wc -l  # manifests
```
As of 2026-05-30: **268** tools · **25** guide hubs · **268** manifests · **22** categories

**Hard Stop:** If any constraint conflicts with legacy specs, follow `CONTRACT.md`.

## 📋 Additional Rules (from post-launch audits)

- **AP2 is mandatory** for any tool whose title/function involves: policy, rule, mandate, routing, compliance, risk assessment, AML, KYC, or gap analysis. When in doubt, add it.
- **Manifest naming:** one file per tool, always `{number}-{slug}.manifest.json`. Never create short-form `{number}-manifest.json` variants — these become orphans.
- **No external JS libraries** for export (no jsPDF, no SheetJS, etc.) unless explicitly bundled inline. Use `URL.createObjectURL(new Blob(...))` + `<a download>` only.
- **`<link rel="canonical">`** uses absolute URLs intentionally — this is correct SEO practice, not a routing violation.
- **JSON-LD schema block** is required on every hub page (see `CONTRACT.md` §6.3).
- **index.html is 5 500+ lines** — high truncation risk in any AI context window. Edit surgically with grep + line numbers rather than reading the whole file.
