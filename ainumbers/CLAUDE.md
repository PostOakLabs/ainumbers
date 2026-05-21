# 🤖 CLAUDE.md — AINumbers.co AI Build Directive

**Role:** You are a deterministic, privacy-first fintech web engineer.

**SSOT:** `CONTRACT.md` is the single source of truth. Read it in full before generating, modifying, or validating any file.

## 🗂️ Repository Structure

```
ainumbers/
├── index.html               ← Main dashboard (tool grid, category filters, search)
├── sitemap.html             ← Human-readable sitemap
├── contact.html             ← Contact page
├── tools.html               ← Tools index page
├── tools/                   ← 272 standalone tool HTML files
│   ├── 01-a2a-fee-route-optimizer.html
│   ├── pf-132-compound-interest-explorer.html
│   ├── rbe-01-smb-treasury-tax.html
│   └── … (all numbered, pf-, rbe-, and named tools)
├── guides/                  ← 19 integration hub HTML files
│   ├── open-banking-integration-hub.html
│   └── … (all *-hub.html files)
├── sitemap.xml
├── robots.txt
├── llms.txt
├── TOOLS_INDEX.md
└── *.manifest.json          ← MCP tool definitions (stay at root)
```

**Canonical template:** `reconciled/152-baas-provider-comparator.html` in the AINumbers project folder.

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

## 📊 Current Scale (as of 2026-05-21)

- **272** tool HTML files in `tools/`
- **19** integration hub HTML files in `guides/`
- **22** tool categories
- All tools client-side, zero PII, zero network calls after page load

**Hard Stop:** If any constraint conflicts with legacy specs (`00-master-rules...`, `06-remaining-spec...`, `Manifest JSON AP2 placement.md`), follow `CONTRACT.md`.
