# 📜 AINumbers.co — Unified Build Contract v1.7
**Maintainer:** Post Oak Labs · **Status:** Production-Ready · **Effective:** May 2026 · **v1.2 (Amendments A1–A2 folded):** June 2026 · **v1.3 (Amendment A3 — ChainGraph sole orchestration surface):** June 2026 · **v1.4 (Amendment A4 — MCP deploy & tool-registration invariants):** June 2026 · **v1.5 (Amendment A5 — SPEC.md SSOT + conformance-by-construction):** June 2026 · **v1.6 (Amendment A6 — reader-facing copy style):** July 2026 · **v1.7 (Amendment A7 — ledger subdomain storage carve-out):** July 2026  

> **SSOT for the OpenChainGraph standard = `repo/chaingraph/standard/SPEC.md`** (+ `openchain-graph-v0.4.schema.json`). This contract references it, does not restate it (Amendment A5). Conformance = the SPEC.md §15 gate suite.
**License:** CC BY 4.0 · **Scope:** All browser-based financial tools, hubs, and MCP integrations  
**Target Audience:** AI Build Instances (Claude/LLMs), Frontend Engineers, Compliance QA  

---

## 📖 How to Use This Document
This is the **Single Source of Truth (SSOT)** for all AINumbers.co builds. It supersedes all prior fragmented specs, resolves identified contradictions, and enforces May 2026 best practices for client-side deterministic architectures, MCP v1+ compatibility, WCAG 2.2 accessibility, and GDPR/ePrivacy session-scoping norms.  
**Read in full before generating any HTML, JSON, or UI component.**

---

## 🔒 0. Immutable Hard Constraints (RFC 2119: MUST)
| Constraint | Specification | Rationale |
|---|---|---|
| **Architecture** | Single self-contained `.html` per tool. All CSS/JS inline. Google Fonts only (`DM Serif Display`, `Sora`, `JetBrains Mono`). | Zero build step, zero dependency drift, portable static deployment. |
| **Runtime** | Synchronous, deterministic execution. Zero `fetch`, `async`, `WebWorker`, or external network calls after page load. Seeded PRNG allowed *only* for synthetic data. | Ensures bit-for-bit reproducible outputs across sessions and clients. |
| **Data Safety** | **Zero PII** collected, stored, logged, or transmitted. Input sanitization strips identifiable fields. Output schemas exclude personal data. | Compliance-first design; eliminates regulatory liability. |
| **Client Storage** | **Forbidden:** `localStorage`, `cookies`, `IndexedDB`, `sessionStorage`, any PII-adjacent cache. All state is in-memory. (`ain_lang` sessionStorage exemption removed — lang toggle deferred; see §1.1.) | Aligns with ePrivacy session-scoping norms; preserves tab-close data wipe. |
| **Routing & URLs** | Internal cross-links **MUST** use relative paths (`../tools/...`). Absolute URLs reserved **strictly** for `suite-registry.json` and external MCP endpoints. | Build-time resilience + portability; prevents broken links on staging/mirrors. |
| **Content Security Policy** | Every `tools/`, `guides/`, and `chaingraph/` page **MUST** carry a `<meta http-equiv="Content-Security-Policy">` tag matching one of three canonical profiles: `CSP_STANDARD` (static tool/doc pages, no worker/iframe), `CSP_WASM_VM` (pages instantiating a Worker/wasm VM), `CSP_COMPOSER` (Orchestrated Workflow Runner pages and ChainGraph chain pages, §5.3/A3.1, needing `frame-src 'self'` for the same-origin bridge iframe). Enforced by `scripts/check-csp-consistency.mjs` (gates both drift from a profile and absence of a tag; ratchet-only baseline, counts only go down). | No server- or edge-level CSP header exists anywhere in the deploy stack (Cloudflare, `.htaccess`, DreamHost) — the meta tag is the **sole** CSP mechanism, so a missing tag is an absent security control, not redundancy. |

---

## 🌐 1. Global UI & Accessibility Contract
### 1.1 Multilingual Toggle — DEFERRED (Option A)
The lang toggle (`.lang-bar` / `setLang()`) has been **removed from all new builds** as of June 2026. The existing toggle on live tools was cosmetic only — it did not translate content, providing no value and a misleading UX for the target audience.

**Do not add a lang toggle to new tools or hubs.** Do not include `.lang-bar` CSS, `setLang()`, `TRANSLATIONS` objects, or `sessionStorage` `ain_lang` writes in any new file.

When bandwidth allows, a proper implementation (translated metadata layer for ES/FR/PT with AR/中文 stubs) is fully specced in **`../I18N-SPEC.md`** (Option B). That spec is the source of truth for any future re-implementation.

**Grandfathered state (existing tools):** ~187 tools built before this amendment retain `.lang-bar` HTML and `TRANSLATIONS` JS in their source. This is a held state — the toggles were cosmetic and do no harm. The AIN Bridge `t()` function in these tools has been pinned to English-only (sessionStorage read removed, Amendment A2). Do not strip their `TRANSLATIONS` blocks until I18N-SPEC.md Option B is ready to replace them; use `scripts/strip_lang_toggle.py --write` at that point.

### 1.2 Mandatory UI Components
| Component | Selector/Pattern | Notes |
|---|---|---|
| Input Panels | `.panel` / `.panel-label` / `.panel-row` | Semantic grouping, explicit `<label>` pairing |
| Run Button | `.run-btn` | Disabled loading state during sync calculation |
| Results Container | `.results-panel` | Hidden by default, revealed post-calculation |
| Export Container | `.results-export-row` | Legacy alias: `.arow { @extend .results-export-row; }` |
| MCP / manifest disclosure | `.mfst-btn` (or inline-styled equiv.) → `#mfstBody` / `#mfstCode`, wired by `toggleMfst()` | **Exactly one** collapsible toggle per tool, placed before the footer; lazy-renders the tool's `MANIFEST` object as formatted JSON. Legacy `.mcp-toggle` / `.mcp-panel` / `toggleMCP()` patterns are prohibited. |
| PII Banner | `.pii-notice` | Placed on identifier inputs (IBAN, BIC, LEI, etc.) |

> **MCP / manifest disclosure (standardized 2026-06-11).** Tools expose `manifest.json` through a single `mfst` toggle: `.mfst-btn` (or an inline-styled equivalent) placed before the footer, controlling `#mfstBody` / `#mfstCode`, opened by `toggleMfst()` which lazy-renders `JSON.stringify(MANIFEST, null, 2)`. The inline `MANIFEST` const is the single source of truth. The legacy `.mcp-toggle` / `.mcp-panel` / `#mcpPanel` / `toggleMCP()` button-and-panel pattern is RETIRED and MUST NOT appear in new or existing tools. Pattern unified with sister suite Apex Logics; swept via `standardize_mcp_toggle.py`.

### 1.3 Unified PII Banner Text
```text
🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.
```
*All tools MUST use this exact phrasing for legal consistency.* This banner is the **one sanctioned em-dash** in reader-facing copy; the §1.4 copy-hallmarks gate exempts its exact string verbatim.

### 1.4 Reader-Facing Copy Style (Amendment A6)
Public HTML pages and the `chaingraph.json` descriptions served to agents are read by outside practitioners; their prose MUST NOT read as machine-generated. The following are **hard rules**, gated by `scripts/check-copy-hallmarks.mjs` (preflight + CI):

- **No em-dashes (—) in human-visible HTML text or in `chaingraph.json` node/chain descriptions.** Rewrite by context: `label — value` → `label: value`; a parenthetical aside → commas or parentheses; a sentence splice → a period, colon, semicolon, or comma. En-dashes (–) in numeric ranges are correct typography and stay. The §1.3 PII banner is the sole exempt em-dash (stripped by the gate verbatim).
- **No internal build codes in visible prose:** `Wave N`, `W-A`…`W-G`, standalone `D0`. Rewrite the sentence plainly. `ART-xx` / `T-xxx` node ids remain allowed in small monospace metadata lines and technical contexts.
- **No AI rhetorical tics:** telegraphic "It is not X. It is Y." twotone constructions, punchy `X, not Y` card fragments, and defensive meta-phrasing ("no workflow fabricates details…"). Keep contrasts that carry real technical meaning; rewrite the conspicuous ones plainly.
- **No italic/bold emphasis in HEADINGS (Tim, 2026-07-20).** `<em>`/`<i>`/`<strong>`/`<b>` inside `h1`-`h6` (including the old two-tone `tool-title <em>Word</em>` pattern) is now a blocking tell, not exempt design styling. Headings render single-color, single-weight. Structural bold in `th`/`dt`/`label`/`legend`/`button` stays exempt (UI chrome, not prose). Body-prose italics were already banned.
- **Guide hubs carry an audience statement** (who the hub is for), in plain prose.
- **In user-facing prose, call OpenChainGraph chains "workflows."** Slugs, file paths, `chaingraph.json` identifiers, and the OpenChainGraph standard vocabulary in `standard/` are unaffected.
- **Date-bearing compliance claims** (regulatory deadlines, enforcement dates) must distinguish obligation-applicability from enforcement where they differ, cite the exact date, and carry an `as of <month year>` currency note plus a primary-source link. Applied on-touch, when a date claim is next edited, not a mandatory field on every tool and not a mass sweep.

**Gate mechanics.** `scripts/copy-hallmarks-baseline.json` holds not-yet-swept legacy debt (Tier 2/3 tool + guide + chain files, the hub CHAIN_INDEX grid, the tool-directory mirrors in `tools.html`/`sitemap.html`, and the `chaingraph.json#descriptions` bucket until Phase C). A baselined file may carry **at most** its recorded count, so counts only ever go down; any file absent from the baseline must be clean, so new hallmarks fail immediately. Regenerate the baseline with `--update` **only** for a deliberate, reviewed exception, never to paper over a regression.

---

## 🤖 2. Machine-Readable Registry & MCP Contract
### 2.1 File Naming & Scope Separation
| File | Purpose | Location |
|---|---|---|
| `suite-registry.json` | Suite-level MCP registry (consumed by external agents) | Root `/` |
| `manifest.json` | Per-tool discovery & validation manifest | `tools/XX-slug/` |

### 2.2 Per-Tool `manifest.json` Schema
```json
{
  "tool_id": "string",          // Matches directory slug exactly (kebab-case)
  "version": "semver",          // Increment on schema/logic changes
  "title": "string",
  "description": "string",
  "category": "cat-XX",
  "tags": ["string"],
  "audience": ["string"],       // Optional persona targeting
  "input_schema": { "type": "object" },  // JSON Schema Draft-07+
  "output_schema": { "type": "object" }, // JSON Schema Draft-07+
  "mcp_tool_definition": {
    "name": "verb_noun_context", // Globally unique, MCP v1+ compliant
    "description": "LLM instruction",
    "inputSchema": { "type": "object" }
  },
  "execution": {
    "type": "browser-javascript",
    "entry": "relative/path.html",
    "function_name": "globalJSFunction",
    "timeout_ms": 5000
  },
  "ap2_export": true | false    // Capability signal, not inclusion filter
}
```
**Rules:**
- `mcp_tool_definition.name` MUST follow `verb_noun_context` snake_case.
- `mandate_type` lives **in the Policy Mandate payload**, NOT in `manifest.json`.
- All tools appear in `suite-registry.json` regardless of `ap2_export` value.

### 2.3 Suite-Level `suite-registry.json` Structure
```json
{
  "$schema": "https://ainumbers.co/schema/mcp-manifest-v1.0.json",
  "name": "AINumbers.co Fintech Intelligence Suite",
  "publisher": "Post Oak Labs",
  "suite_url": "https://ainumbers.co",
  "version": "1.0.0",
  "tool_count": "dynamic",
  "ap2_export_count": "dynamic",
  "license": "CC-BY-4.0",
  "tools": [ /* array of tool objects mirroring manifest schema */ ]
}
```

### 2.4 Prefill Deep-Links (AIN Bridge v1.0) — Amendment A1.1
Bridge-enabled tools (manifest flags `"prefill": true`, `"bridge_version": "1.0"`) MUST accept:
```
tools/{slug}.html#in=<base64url(JSON of {element_id: value})>[&run=1]
```
- JSON maps input element IDs → values; a `{"fields":{...}}` wrapper is also accepted.
- Default is **fill-only** with a visible notice bar; `&run=1` opts into auto-executing the manifest-declared `execution.function_name`.
- Inputs travel in the URL hash fragment — never transmitted to a server. Zero-PII rules apply (synthetic values only).
- Values are assigned via `.value`/`.checked` only (never innerHTML); run functions are limited to the per-tool CFG whitelist.

### 2.6 MCP Registry & Directory Registrations (Amendment A2.1)
The MCP Apps server (`https://mcp.ainumbers.co/mcp`) is registered in the official MCP registry (`co.ainumbers/tools`) and multiple directories (Anthropic Connectors, PulseMCP, Glama, mcp.so, awesome-mcp-servers). Current submission status, Track A domain-key steps, and Track B form fill-in data are tracked in **`../REGISTRY-LOG.md`** (workspace root, outside `repo/`). Update that file and republish Track A (`mcp-publisher.exe publish` with a bumped `version` in `mcp-apps-poc/server.json`) whenever the MCP server materially changes.

### 2.5 MCP Workflow-Chain Integrity (Amendment A1.5)
The MCP server (`mcp-apps-poc/worker.mjs`) exposes the `build_workflow_links` tool, backed by a `NAMED_CHAINS` map. Each chain MUST satisfy:
- Every `steps[].slug` corresponds to a real `tools/<slug>.html` (or `rbe-*`) — a missing file means the server hands out **404 deep-links**.
- Every `composer_url` resolves to a real `guides/*.html`.
- Where a chain has a `composer_url`, its ordered `steps[].slug` list **equals** that composer's `STAGES` slug list — the chain, the composer page, and the underlying tools must all agree.

**Validator (run before every `wrangler deploy`):** `mcp-apps-poc/scripts/validate-chains.mjs` — zero-dependency Node. From `mcp-apps-poc/`:
```bash
node scripts/validate-chains.mjs   # or: npm run validate:chains
```
Missing tool/composer files are **errors** (non-zero exit → block deploy); chain↔composer sequence divergence prints as a **warning**. Paths default to the sibling `repo/` layout; override with `WORKER_PATH`, `TOOLS_DIR`, `GUIDES_DIR`. This check exists because Wave-2 chains once referenced invented slugs (e.g. `53-stablecoin-compliance-checker` vs the real `53-cbdc-architecture-comparator`), silently 404ing on the live server.

---

## 📦 3. AINumbers Policy Mandate Schema & UI Contract
### 3.1 AINumbers Policy Mandate v1.0 Schema (not AP2)

> **Naming note:** AINumbers' Policy Mandate schema is AINumbers' own structured-mandate format for compliance, regulatory, and policy artifacts. It is **NOT** Google's Agent Payments Protocol (AP2). Real AP2 (see [ap2-protocol.org](https://ap2-protocol.org/)) defines IntentMandate / CartMandate / PaymentMandate for agent-mediated payment flows — a different problem domain. AINumbers tools whose names include "AP2" (102, 320, 323, 326) operate in the AP2 problem domain but emit AINumbers Policy Mandates describing assessments and policies *about* AP2 use cases — they do not emit real AP2 mandates. The internal JS identifier `AP2Schema`, button id `ap2ExportBtn`, and manifest flag `ap2_export` are legacy names kept for stability. The in-payload `ap2_version` field (value `"1.0"`) is **retired as of v0.4** — it duplicated the schema version under an AP2-implying name and is no longer part of the canonical schema; `chaingraph_version` is the sole envelope version.

Adopted for human-readable audit + machine-agent ingestion. `execution_hash` added as optional audit metadata.
```json
{
  "mandate_id": "UUIDv4",
  "issued_at": "ISO 8601",
  "issued_by": "ainumbers.co",
  "tool_id": "string",
  "tool_version": "semver",
  "mandate_type": "payment_policy|aml_rule|kyc_requirement|routing_policy|compliance_control|risk_parameter|credit_assessment|fx_policy|scheme_rule|disclosure_template|fee_schedule_mandate|velocity_rule_mandate|incident_classification_mandate|routing_policy_mandate|agent_guardrail_mandate",
  "jurisdiction": ["ISO 3166-1 alpha-2"],
  "regulatory_frameworks": ["string"],
  "payload": { "key": "value" },
  "summary": "1–3 sentence plain English",
  "agent_instructions": ["ordered action strings"],
  "valid_from": "ISO 8601",
  "valid_until": "ISO 8601",
  "last_reviewed": "ISO 8601",
  "source_tool_inputs": {},
  "regulatory_citations": ["string"],
  "audit_metadata": {
    "execution_hash": "SHA-256(optional)",
    "client_side_executed": true,
    "zero_pii_verified": true,
    "deterministic_run": true
  }
}
```

### 3.2 UI & Interaction Contract
- **Placement:** MUST reside in `.results-export-row`. Positioned immediately after sibling export buttons. NEVER in footer/header/floating/modals.
- **State Management:**
  | State | Attribute/Class | Behavior |
  |---|---|---|
  | Pre-Run | `disabled`, `opacity: 0.28`, `cursor: not-allowed` | Tooltip: `"Run the analysis above to generate a Policy Mandate"` |
  | Post-Run | Remove `disabled`, add `.ready`, `opacity: 1` | Tooltip: `"For API integration · audit trail"` |
- **Validation:** MUST call `AP2Schema.validate()` before `URL.createObjectURL()`. Block download on failure; show red toast with validation errors.
- **File Naming:** `{tool_id}_{YYYYMMDDHHMMSS}.policy.json`

### 3.3 Policy Mandate Intake — Amendment A1.2
Tools MAY accept a `.policy.json` mandate as **input** via drop/choose/paste (FileReader — local only; CFG flag `intake: true`). Mapping: `payload` and `source_tool_inputs` keys → matching element IDs; validator tools additionally receive the full mandate in their input textarea (`intakeTarget`). The Policy Mandate is the suite's interchange format between tools.

---

## 📤 4. Export Tier System
Prevents client-side bloat & enforces deterministic guarantees.

| Tier | Formats | Requirement |
|---|---|---|
| **Tier 1 (Mandatory)** | `Policy Mandate JSON` + `Markdown` | All policy, rule, mandate, routing, compliance, or calculator tools |
| **Tier 2 (Conditional)** | `CSV` | Tools with tabular/batch/reconciliation outputs |
| **Tier 3 (Opt-in)** | `SVG` / `PDF` / `Nygard ADR` | Only when explicitly requested in tool brief or requires visualization/memo output |

*Implementation:* All exports MUST use `URL.createObjectURL(new Blob([content], {type:'...'}))` + `<a download>`. No external libraries (jsPDF, etc.) unless explicitly approved & bundled inline.

**Wave-5 tools (Amendment A2.2):** T465–T468 (CARF/DAC8/1099-DA crypto-tax) and T472, T475–T476 (Basel LCR/NSFR/Pillar 3, Pillar Two GloBE safe harbour) carry Tier 1 export obligation — their outputs are policy and compliance assessments covered by `compliance_control`, `risk_parameter`, and `disclosure_template` mandate types (§3.1).

---

## 🔢 5. Tool Numbering & Hub Architecture
### 5.1 Canonical Ranges (Global & Sequential)
| Category | T-Range | Status | Notes |
|---|---|---|---|
| Cat-12 AML/KYC | T109–T131 | 22 live | |
| Cat-13 B2B Payments | T132–T151 | 16 live | T137, T138, T142, T143 RESERVED |
| Cat-14 BaaS | T152–T164 | 12 live | |
| Cat-15 E-Invoicing | T165–T177 | 10 live | |
| Cat-16 BNPL | T178–T187 | 8 live | |
| Cat-17 Credit Risk | T188–T199 | 8 live (Phase 1) | T196–T199 RESERVED |
| Cat-18 FX & Cross-Border | T200–T214 | 13 live | T203 RESERVED; T211–T214 available |
| Cat-19 Payment Schemes | T215–T229 | 8 live | T221, T224, T225–T229 RESERVED/available |
| Cat-20 SME Health | T230–T244 | 9 live | |
| Cat-21 Real-Time Payments | T245–T259 | 8 live | T248, T250, T253–T259 RESERVED |
| Cat-22 DORA | T260–T269 | DEFERRED | |
| **Cat-2 Upgrade** | T311–T318 | 8 live | Follows DORA; T269–T299 unassigned |
| **RBE Suite** | RBE·01–RBE·13 | 13 live | Lives under `ai` category |

### 5.3 Orchestrated Workflow Runner pages (page architecture #4) — Amendment A1.4 **[DEPRECATED — see Amendment A3 / arch #5]**
A fourth valid page architecture (rubric-scored with its own profile): a guide-level **Runner** (`guides/*-composer.html`) that loads bridge-enabled tools in **same-origin iframes** and orchestrates them via the bridge messaging API (`ain:prefill` / `ain:run` / `ain:getMandate`). Permitted deviations, valid ONLY for this class:
- CSP `frame-src 'self'` (standard guides remain `frame-src 'none'`).
- Same-origin iframes count as page-load resources, not post-load network calls.
- Emits a **composite Policy Mandate** whose payload carries the ordered stage mandates; MUST validate against the §3.1 required-field set before download. Tier 1 export (Policy JSON + Markdown transcript).
- `mandate_id` MAY use `crypto.getRandomValues` UUIDv4 (exception to determinism for ID generation only; stage payloads remain deterministic).
- Required: JSON-LD HowTo block, PII banner text per §1.3.

**Rules:**
- Never reset, never reuse RESERVED numbers.
- T300 deliberate architectural break from T268 is documented and permitted.
- T380/T381 disambiguation (2026-06-11): T380 (`physical-climate-risk-assessor`) and T381 (`eu-green-bond-standard-screener`) are confirmed distinct tools. An earlier duplicate file state was resolved; both are live and valid. Do not merge or renumber.
- Cross-link, don't clone. Use Journey Track/Quick-Start for workflow routing.
- Drop tools marked DROPPED/CONSOLIDATED in the Overlap Registry.

### 5.2 File Path Convention
- **Hub:** `guides/{category-slug}-hub.html`
- **Tool:** `tools/{number}-{kebab-slug}.html`
- **Index Update:** Add `data-cat="cat-XX"` to all tool cards in `index.html`. Update sidebar badges, hero stats, and MCP summary table rows.

### 5.4 The `start.html` family-hub rule (Amendment, START-NAV-1)
`start.html`'s "Explore the suite" grid links FAMILIES, never individual tools. One card per family hub; grid hard cap 12 cards. A new surface earns `start.html` presence by joining (or founding) a family hub, never by adding its own card. Card additions require a founding hub page and must cite this rule in the PR.

---

## ✅ 6. Build & Quality Assurance Workflow
### 6.1 Pre-Flight Checklist (AI Build Instance)
- [ ] Single `.html` file, fully self-contained, inline CSS/JS
- [ ] **No `.lang-bar` / `setLang()` / `TRANSLATIONS` object** — lang toggle deferred (§1.1)
- [ ] Metadata badges in header/footer
- [ ] PII banner on identifier inputs (exact text per §1.3)
- [ ] All cross-tool links use relative `../tools/` paths
- [ ] Zero external scripts, CDNs, APIs, or network calls
- [ ] Zero `sessionStorage` / `localStorage` / `cookies` / `IndexedDB` writes
- [ ] Financial/regulatory claims have numbered citations
- [ ] Input validation covers empty, negative, non-numeric, malformed
- [ ] Export output matches Tier system contract
- [ ] Complex logic & payments math are inline-commented
- [ ] `python scripts/regen_sitemap.py --apply` run after adding any new tool or guide (Amendment A2.3)

### 6.2 Pre-Merge Validation Pipeline
**`node scripts/check_tools.js` is the BLOCKING first gate** — it parses every tool's inline JavaScript and exits non-zero if any `<script>` has a syntax error. NEVER commit or merge tool HTML while it reports a failure; run `node scripts/locate_errors.js` to pinpoint each break. (Added 2026-06-11 after a structural JS edit silently deleted live code in dozens of tools — syntax errors are invisible until a user hits them.)
```bash
# 0. JS syntax gate — MUST exit 0 (blocking; no tool may ship with a broken inline <script>)
node scripts/check_tools.js
# Validate all manifests against schema
npm run lint:manifests
# Verify Policy Mandate schema compliance on generated payloads
npm run test:ap2-exports
# Enforce UI placement rule via DOM inspection tests
npm run test:ui-ap2-placement
```
When MCP server chains change (`mcp-apps-poc/worker.mjs`), also run the chain-integrity validator before `wrangler deploy` (see §2.5):
```bash
cd mcp-apps-poc && npm run validate:chains
```
**SSOT conformance gates (Amendment A5)** — run from the site repo root before any push that touches `chaingraph.json`, the spec/hub HTML, `standard/`, or a kernel:
```bash
node chaingraph/standard/schema-validate.mjs          # envelope + node object vs the v0.4 schema (strict)
node chaingraph/standard/spec-version-consistency.mjs  # one version of record across SPEC.md/schema/spec page/hub
node chaingraph/standard/spec-gate-coverage.mjs        # every §15 rule names a wired gate (meta)
node chaingraph/standard/surface-parity.mjs            # displayed counts == counts.json
node chaingraph/standard/catalog-parity.mjs            # pages <-> chaingraph.json (both ways)
# worker repo post-deploy (mcp-apps-poc/.github/workflows/ci.yml): hash-sweep.mjs · verify-mcp-registered.mjs --all
```

### 6.3 Global Quality Checklist
**Per-Hub:**
- [ ] Correct accent tokens, no hardcoded hex outside `:root`
- [ ] Journey track references correct T-numbers (no RESERVED)
- [ ] `Last Reviewed` datestamp on regulatory/schema tools
- [ ] JSON-LD schema block present
- [ ] Mobile responsive (stats 2-col, grid 1-col, track vertical)

**Per-Tool:**
- [ ] `manifest.json` present, `tool_id` matches directory, `ap2_export` correct
- [ ] `mcp_tool_definition.name` globally unique
- [ ] Policy Mandate button present where `ap2_export: true`, validates before download
- [ ] `execution.function_name` corresponds to callable global JS function
- [ ] Deterministic output verified across 3 identical runs

### 6.4 AIN Bridge Snippet — Amendment A1.3
Master copy: `scripts/ain-bridge-v1.snippet.html`. Per-tool copies are inserted verbatim before `</body>` with a one-line `window.AIN_BRIDGE_CFG={runFn,intake,intakeTarget,intakeAnchor}`. The bridge provides prefill (§2.4), intake (§3.3), and same-origin parent messaging for Runners (§5.3); its UI strings are English-only (lang toggle deferred — §1.1). Tools with a non-downloading mandate builder SHOULD expose it as `window.AIN_BUILD_MANDATE()` so Runner capture works without an export click. Constraints honored: zero network, zero storage reads or writes. Manifest signals: `prefill`, `bridge_version`; `mcp/catalog.json` carries `metadata.prefill` (regenerated via `scripts/regen_catalog.py` — never hand-edit).

---

## 📎 Appendices
### A. CSS Design Tokens (Copy Verbatim)
```css
:root {
  --bg:#080E1A; --bg-2:#0D1627; --bg-3:#111E35; --bg-4:#162340;
  --border:#1E2F4A; --border-2:#263855; --muted:#3A5270; --body:#6888A8;
  --text:#A8C4DE; --bright:#D4E8F8; --white:#EEF6FD;
  --teal:#14B8A6; --teal-dim:rgba(20,184,166,.12); --teal-lt:#2DD4BF;
  --gold:#D4A847; --gold-dim:rgba(212,168,71,.12);
  --green:#22C55E; --green-dim:rgba(34,197,94,.12);
  --red:#EF4444; --red-dim:rgba(239,68,68,.12);
  --warn:#F59E0B; --purple:#9B72F5; --purple-dim:rgba(155,114,245,.12);
  --radius:6px; --radius-lg:10px;
}
/* Hub accents: Cat-12=--red | Cat-13=--teal | Cat-14=--purple | Cat-15=--gold | Cat-16=--red | Cat-17=--gold | Cat-18=--teal | Cat-19=--purple | Cat-20=--green | Cat-21=--teal | Cat-22=--red | Cat-2=--teal */
```

### B. Multilingual Toggle — Deferred
The lang toggle template has been removed from active builds. See **`../I18N-SPEC.md`** for the full Option B implementation spec (I18N object pattern, upgraded `setLang()`, ES/FR/PT full translation, AR/中文 stubs, `data-i18n` attribute convention, and rollout sequence). Do not implement from memory — use that spec.

### C. Policy Mandate Export Button Pattern
```html
<div class="results-export-row">
  <button class="btn btn-ghost btn-sm" id="ap2ExportBtn" disabled>
    {} Export Policy Mandate
    <span class="btn-subtitle">API · audit trail</span>
  </button>
</div>
<script>
function enableAP2Btn() {
  const btn = document.getElementById('ap2ExportBtn');
  if(btn) { btn.disabled = false; btn.classList.add('ready'); }
}
function exportAP2() {
  // 1. Validate payload against AP2Schema (internal JS name — see §3.1 naming note)
  // 2. If valid: URL.createObjectURL + trigger download
  // 3. If invalid: show toast, block
}
</script>
```

---

## 🔗 Amendment A3 — ChainGraph as the sole orchestration surface (v1.2 → v1.3)

**Date:** June 2026 · **Companion docs:** `WebGPU/CHAINGRAPH-V1_2026-06-12.md` (§4 artifact), `chaingraph-chains-schema_2026-06-13.md`, `CHAINGRAPH-CONVERSION-BUILD-SPEC_2026-06-13.md`

**Context:** AINumbers shipped two multi-tool orchestration surfaces (Scenario Guides + Live Workflows; and Composer Runners, arch #4) alongside the hash-anchored `chaingraph/` suite. **Decision: collapse to one surface — ChainGraph — and make verifiable hash-chaining a contract-level MUST.**

### A3.1 · Page architecture #5 — ChainGraph chain page (RFC 2119: MUST)

A fifth valid page architecture, **superseding architecture #4** (Composer Runner, now DEPRECATED). A ChainGraph chain page (`/chaingraph/chains/<chain-id>.html`) MUST:

1. Load its ChainGraph node tools in **same-origin iframes** and orchestrate them via the AIN Bridge messaging API (`ain:prefill` / `ain:run` / `ain:getMandate`); reuse `scripts/ain-bridge-v1.snippet.html`. CSP `frame-src 'self'` (the only permitted relaxation, inherited from #4).
2. **Hash-chain every handoff:** at each stage, capture the node's §4 artifact, read its `execution_hash`, and inject it into the next stage's `chain.parent_hashes` + `parent_tool_ids`, setting `chain_depth = max(parent depths) + 1`. The edge MUST be a hash citation, never editorial prose.
3. Emit a **composite §4 artifact** (schema A3.2) whose `output_payload` carries the ordered stage artifacts; Tier-1 export (artifact JSON + Markdown transcript); MUST `validate()` against A3.2 before download. `mandate_id` MAY use `crypto.getRandomValues` UUIDv4 (the sole determinism exception, ID-only).
4. Render the chain as an **interactive node/edge graph** (nodes = tools, edges = consumes/feeds read from `chaingraph.json`), highlighting completed stages and the carried hash. Inline Mermaid or raw SVG only — no new external libraries.
5. **Branching chains** (former Scenario Guides) MUST declare each path in `chaingraph.json` `chains[].branches` and swap nodes by branch key, mirroring the existing branching Runner pattern.
6. Obey **all §0 hard constraints**: single self-contained HTML, zero PII, **zero forbidden storage (no `sessionStorage`/`setLang` stub)**, zero post-load network beyond the same-origin iframes, every regulatory claim real and citable.

The nouns **"composer," "workflow," and "scenario guide" MUST NOT appear** in any shipped surface copy. The only orchestration namespace is `/chaingraph/`.

### A3.2 · Mandatory chain block + execution_hash (RFC 2119: MUST)

The canonical orchestration artifact is the CHAINGRAPH §4 schema. Every ChainGraph node tool and chain page MUST emit it; `execution_hash` and the `chain` block are **REQUIRED** (they were optional under §3.1). **v0.4:** `chaingraph_version` is the sole canonical envelope-version field and `@context` the JSON-LD anchor. `ap2_version` is **RETIRED** — it was a misnamed legacy envelope label (value `"1.0"`/`"1.0.0"` = the AINumbers Policy Mandate schema version, *not* the AP2 standard version, which is v0.2) and is **no longer emitted**; the verifier still tolerates it on pre-retirement artifacts for back-compat. Tools that genuinely validate AP2 v0.2 structures declare it via `dct:conformsTo` → the AP2 v0.2 spec, not via this field.

**The canonical §4 artifact envelope and the `execution_hash` preimage rule are normative in `repo/chaingraph/standard/SPEC.md` §1/§4** and machine-checked by `openchain-graph-v0.4.schema.json` (`schema-validate`) — **they are not restated here** (Amendment A5; the prior inline copy is retired to avoid a second, drift-prone definition). In brief, for build authors: `execution_hash` = WebCrypto SHA-256 over the **RFC 8785 / JCS-canonical** JSON of exactly `{policy_parameters, output_payload}`, produced via the shared `kernels/_hash.mjs` (no other canonicalizer — see SPEC.md §4 FORBIDDEN list). Root artifacts use `parent_hashes: []`, `chain_depth: 0`; a consuming tool copies each parent's `execution_hash` into `parent_hashes` and sets `chain_depth = max(parent depths)+1`. Every chain MUST be independently re-verifiable (enforced live by `hash-sweep`).

### A3.3 · Single surface; deprecations (RFC 2119: MUST)

- `/chaingraph/` is the **sole** orchestration namespace. Chain pages at `/chaingraph/chains/<id>.html`; nodes at `/chaingraph/<code>-<slug>.html`; hub at `/chaingraph/chaingraph-hub.html`.
- **Chain slug convention (normative, 2026-06-22):** `<domain-word>-<specifics>`, lowercase-kebab, spelled-out domain — NO invented initialisms (bad: `aer-fit`, `tcm-collateral`; good: `agent-economy-fit`, `treasury-clearing-collateral`). Proper-noun product/regulation names are allowed lowercase (mica, arc, canton, cbam, pqc). `mcp_name` stays `verb_object` snake_case and is NEVER renamed to match the slug. Add `.htaccess 301`s when renaming existing slugs.
- **DEPRECATED and removed** on conversion: page architecture #4 (Composer Runner), the Scenario Guide type, the Live Workflow type, and the 3 Diagnostic pages (rebuilt as single-node ChainGraphs). **Hubs are retained** as category navigation.
- Deprecated pages are **hard-removed** (no 301 redirects). The `guides/` directory retains only hubs + explicitly-kept utility/demo pages (`regression-replayer.html`, `mcp-agent-demo.html`).

### A3.4 · No duplication (RFC 2119: MUST)

A capability MUST exist in exactly one place. When a chain step is already served by a catalog tool, that tool is **promoted** (moved to `/chaingraph/`, given the §4 artifact, removed from `repo/tools/` + catalog). Any catalog tool whose function is **fully covered** by a ChainGraph node MUST be retired once that coverage is live and parity-checked — there is **no catalog/node twin**. A catalog tool remains in `/tools/` only if no node covers its function.

### A3.5 · mandate_type taxonomy + crosswalk (RFC 2119: MUST)

ChainGraph artifacts use the **§4 internal `mandate_type` taxonomy, which is normative in `repo/chaingraph/standard/SPEC.md` §5** (not restated here — Amendment A5). It is an **internal AINumbers taxonomy, not AP2 v0.2 spec vocabulary** — state that on the hub and in any tool whose name includes "AP2."

Promoted tools switch from the §3.1 Policy Mandate set to the §4 set. A documented **Policy-Mandate ↔ §4 crosswalk** MUST live in `data/ap2-templates.json` (with changelog + semver). The §3.1 Policy Mandate v1.0 schema **remains valid for un-promoted catalog tools** only.

### A3.6 · Removal mechanics & gates (RFC 2119: MUST)

- **Per-chain parity checklist + Tim sign-off** before any guide/tool is deleted; never delete before the replacement is live.
- **Zero-dangling-reference gate:** a build-time scan greps all hrefs (hubs, `index.html`, nav, sitemap) against the delete+promote manifest and MUST return zero references to removed paths before deploy. Each hub link to a removed file is rewritten to its `/chaingraph/...` target (single chain → `/chaingraph/chains/<id>.html`; multi-chain → `/chaingraph/?cat=<category>`).
- **Deletions run via Tim's PowerShell**, one pasteable `git` block per parity-approved chain (full absolute paths; `git mv` for promotions). No `wrangler deploy` in the commit block — push to master triggers GitHub Actions.

### A3.7 · Validation & discoverability (RFC 2119: MUST)

- `mcp-apps-poc/scripts/validate-chains.mjs` is **extended** to validate the new `chaingraph.json` `chains[]` array: every `steps[].node_id` resolves to a `nodes[]` entry; `chain_id` matches its `NAMED_CHAINS` key; `page_url` resolves to a real file; ordered steps are contiguous. Non-zero exit blocks deploy. The worker's `NAMED_CHAINS` becomes a **generated projection** of `chains[]`, never hand-edited.
- **Agentic discoverability:** every chain and node MUST appear in `sitemap`, `llms.txt`, and `chaingraph.json`, each with a one-line summary + canonical deep-link; `robots.txt` allows the major AI crawlers; ping sitemap/IndexNow on publish. A page absent from these is undiscoverable to agents — treat as a build failure.

### A3 · Recorded trade-offs

- Inbound external links to removed guide URLs break (accepted — A3.3). The MCP `composer_url` fields are repointed to chain pages.
- Two export schemas coexist transitionally: §4 (ChainGraph) and §3.1 Policy Mandate (un-promoted catalog tools). The crosswalk (A3.5) keeps them reconcilable; the long-term direction is §4 only.
- The catalog tool count **drops** as tools are promoted/retired — update the "counts drift" verification and any hardcoded totals.
- This amendment supersedes the optional-`execution_hash` language in §3.1 for ChainGraph artifacts, deprecates architecture #4 in §5.3, and updates the §1.2 disclosure rules to the `/chaingraph/` surface.

---

## 🚨 Amendment A4 — MCP Server deploy & tool-registration invariants (v1.3 → v1.4)

Codifies the rules that prevent the recurring "MCP down after a build" outages (root-caused 2026-06-19). **RFC 2119: MUST.** Applies to EVERY new or renamed tool, node, chain, or kernel, in every session. Two repos are in play: the **site repo** (`repo/` — tool/chain HTML, `chaingraph.json` source) and the **server repo** (`mcp-apps-poc/` — the Cloudflare Worker + vendored `data/`/`kernels/`).

### A4.0 · `chaingraph.json` is a GENERATED artifact — write shards, never the monolith (MUST, added CGSHARD-1 CS-1; ordering amended CS-2)
`chaingraph/chaingraph.json` is generated from `chaingraph/graph/nodes/<tool_id>.json` (one file per node), `chaingraph/graph/chains/<name>.json` (one file per chain), and `chaingraph/chaingraph.meta.json` (header + shard id set), by `node scripts/assemble-chaingraph.mjs`. It stays COMMITTED — every consumer (this doc's A4.2 vendor step, gates, runtime pages) keeps reading it unchanged. **CANONICAL ORDER (CS-2):** nodes are emitted sorted by `tool_id`, chains sorted by `name`, both via a numeric-aware natural sort (`Intl.Collator('en', {numeric:true})` — so `art-9` < `art-10` < `art-100`, never lexical). `order.nodes`/`order.chains` in `chaingraph.meta.json` are the SET of shard ids to include; the assembler re-sorts at assembly time regardless of array position, so append order never matters. **New waves MUST:** (1) write the new node/chain object to its own shard file under `chaingraph/graph/nodes/` or `chaingraph/graph/chains/`; (2) append its id (`tool_id` for nodes, `name` for chains) to `order.nodes`/`order.chains` in `chaingraph.meta.json`; (3) run `node scripts/assemble-chaingraph.mjs` to regenerate `chaingraph.json`; (4) commit the shard(s), the updated `chaingraph.meta.json`, and the regenerated `chaingraph.json` together. **NEVER** `JSON.parse`/mutate/`writeFileSync` `chaingraph.json` directly in a new script — that reintroduces the single-file contention CS-1 removed. Verify: `node scripts/assemble-chaingraph.mjs --check` (wired into `preflight.mjs` and CI) — hard-fails if `chaingraph.json` drifts from its shards. The historical `scripts/add-*-nodes.mjs` / `scripts/upgrade-to-v0.*.mjs` one-shot scripts predate this and are left as-is (already run, not reused).

### A4.1 · Unique `mcp_name` across the WHOLE registration surface (MUST)
The Worker registers, by tool name: (a) every **live `chaingraph.json` node** (`mcp_name`), (b) every **PILOT widget tool** (`mcp-apps-poc/pilot.mjs` → each manifest's `mcp_tool_definition.name`), and (c) the fixed **utility tools** (`list_ainumbers_tools`, `build_workflow_links`, `verify_execution_hash`, `build_chaingraph`, `emit_chaingraph_artifact`, `build_session_receipt`). A name **MUST be unique across all three sets** — not just among nodes. A duplicate threw `Tool X is already registered`, aborting `buildServer()` and 500-ing the entire `/mcp` handshake while the rest of the worker still served. Before adding/renaming a tool/node, verify uniqueness with **`node mcp-apps-poc/scripts/check-tool-names.mjs`**. (The Worker also defensively skips duplicates, but a skipped tool is a silently-missing tool — uniqueness is still required.)

### A4.2 · Re-vendor + commit generated worker inputs in the SAME push (MUST)
The Worker boots from **generated/vendored** files: `data/` (served via the ASSETS binding — `chaingraph.json`, manifests, `counts.json`) and `kernels/` (server-side compute). These are produced by `mcp-apps-poc/generate.mjs`, which reads the sibling `../repo` and **therefore cannot run in any cloud build.** Any change to `chaingraph.json`, a manifest, `pilot.mjs`, or a kernel MUST be followed by `node generate.mjs` and a commit that includes the regenerated `data/` **and** `kernels/` in the SAME push. Uncommitted/stale generated inputs = the worker deploys without them and breaks. (`git status` must show `data/` + `kernels/` clean before push.)

### A4.3 · Canonical `execution_hash` via the one shared module (MUST)
Every artifact's `execution_hash` MUST be a real **WebCrypto SHA-256** over the **RFC 8785 / JCS-canonical** `{policy_parameters, output_payload}` produced by the single shared canonicalizer **`repo/chaingraph/kernels/_hash.mjs`** (browser tools inline it at build; the Worker imports it; both byte-identical). **FORBIDDEN:** array-replacer canonicalization (`JSON.stringify(x, Object.keys(x).sort())`), non-SHA-256 placeholders (`simpleHash`/djb2/FNV, any string mislabeled `sha256:`), hashing a reduced object different from the stored `output_payload`, or embedding the hash inside the hashed payload. The hash MUST anchor the inputs (fold decision inputs into `policy_parameters`). Enforced by `lint-forbidden-hash.mjs`, `golden-parity.test.mjs`, and `parity-art-01.test.mjs`.

### A4.4 · The deploy model is fixed (MUST)
The MCP Worker deploys **solely via the gated GitHub Actions workflow** (`mcp-apps-poc/.github/workflows/ci.yml`: `validate` → `deploy`). **Cloudflare Workers Builds MUST stay DISCONNECTED** — running both is a double-deployer and causes outages. Do NOT add `wrangler deploy` / a `wrangler-action`, do NOT hand-deploy, and do NOT hand-edit the Worker `NAMED_CHAINS` (it is a generated projection of `chaingraph.json` `chains[]`).

### A4.5 · CI gates are mandatory and MUST NOT be removed (MUST)
The pipeline runs — and MUST keep running — `check-tool-names.mjs` (no name collisions), `wrangler deploy --dry-run` (bundle resolves), and the post-deploy `scripts/smoke-mcp.mjs` (a real `/mcp` `initialize`). **A green bundle does NOT prove the handshake works — only the smoke test does.** After any worker-affecting push, confirm Actions is green AND the smoke step passed AND `/mcp` `initialize` returns HTTP 200 before considering the build done. History + rationale: memory `feedback_wrangler_deploy_in_commit_block`.

### A4.6 · The kernel registry is codegen — never hand-edit `index.mjs` (MUST)
`repo/chaingraph/kernels/index.mjs` (the `tool_id → kernel` dispatch map the Worker imports) is **auto-generated from the `*.kernel.mjs` files on disk** by `repo/chaingraph/kernels/gen-index.mjs`. The Worker bundles statically (esbuild/wrangler — no runtime filesystem glob), so the registry MUST stay explicit `import` statements; generating them from the filesystem makes the "added a kernel file but forgot to register it" omission structurally impossible (the Wave 26 / NIS2 red-CI gap: 174 nodes, 168 kernels). **Workflow:** drop `chaingraph/kernels/<tool_id>.kernel.mjs` → run `node chaingraph/kernels/gen-index.mjs --write` → done (index.mjs auto-includes it; removing the file + `--write` removes it). **Never hand-edit `index.mjs`** — it carries an `AUTO-GENERATED … DO NOT EDIT BY HAND` banner, and the `gen-index.mjs --check` gate (wired into `preflight.mjs` + `deploy-to-dreamhost.yml`) fails a stale or hand-edited file. `check-kernel-coverage.mjs` stays as the complementary backstop (a chaingraph *node* with no kernel *file* at all; codegen only guarantees every kernel *file* is registered). After `--write`, re-vendor per §A4.2 (`cd mcp-apps-poc && node generate.mjs`, commit `data/` + `kernels/` same push).

### A4.7 · Worker outbound egress is a NAMED, CLOSED allowlist (MUST, added EGRESS-ALLOWLIST-1)
The MCP Worker (`mcp-apps-poc`) MAY make outbound network calls **only** to hosts named in the list below. This is a **closed** list: a host that is not named is not permitted. **There is NO wildcard entry and there MUST never be one** — a wildcard is not a shorter allowlist, it is the absence of one. Adding a host is a CONTRACT amendment to this section, carried by its own WU alongside the integration that needs it; an integration MUST NOT ship ahead of its §A4.7 entry.

**The allowlist (complete, as deployed):**

| Host | Used by | Purpose | Auth |
|---|---|---|---|
| `api.gleif.org` | `mcp-apps-poc/lei-kyb.mjs` (`GLEIF_HOST`, `fetchGleifRecord`) | GLEIF v2 LEI record lookup for the LEI/KYB grading tool. Public JSON:API, no credential, ~60 rpm — cache accordingly. | none |

That is the entire list — **one host**. The Worker holds **no runtime secret** and no allowlist entry requires one; an integration that would introduce the first runtime secret needs its own security review weighing that secret's blast radius, not a §A4.7 edit (precedent: the Vanta evidence-push integration was dropped for exactly this reason and is deliberately absent here, including as a reserved or commented-out entry).

**RFC 3161 TSAs are NOT worker egress, and MUST NOT be added to this list on the assumption that they already are.** Verified against `origin/master` at authoring time: the Worker's RFC 3161 support is **verify-only and 100% offline** — `kernels/_rfc3161.mjs` contains **zero** `fetch` calls and validates a timestamp token against a **pinned** `FREETSA_ROOT_PEM` using `node:crypto` alone, and `_blta.mjs` states in-file that the Worker has *"no existing TSA-REQUEST integration"*, explicitly FLAGS obtaining a fresh timestamp as not built, and names anchor-suite as the natural future owner. Live TSA traffic belongs to the **anchor-suite / `anchor.ainumbers.co`** surface, which is not this Worker. The one `freetsa.org/tsr` call in the repo is in `scripts/_regen-input-attestations-fixture.mjs`, a developer fixture-regeneration script that never runs in the Worker. If a future WU adds a real TSA client to the Worker, it amends this table then — it does not inherit permission from this note.

**Browser tools remain §0 zero-egress — unchanged and unaffected by this section.** §A4.7 authorizes **worker-side** calls only. Every `tools/`, `guides/`, and `chaingraph/` page stays bound by §0 *Runtime* ("Zero `fetch`, `async`, `WebWorker`, or external network calls after page load"). Nothing in this section relaxes that, and no browser page may call any host named above. **Enforcement note:** the browser-side constraint is carried by §0 policy, the per-page CSP tag (§0 *Content Security Policy*, gated by `scripts/check-csp-consistency.mjs`), **and a static text scan of every `tools/`, `guides/`, and `chaingraph/` page** (`scripts/check-site-egress.mjs`, wired into `preflight.mjs` + `html-verify.yml`) for `fetch(`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`/URL-`import(`. It is baseline-shielded (`scripts/site-egress-baseline.json`) against known-inert textual matches (vendored-library dead code, sample text inside a template literal, unreachable WASM glue) and excludes exactly one lawful exception, `ledger/` (§A7, `check-ledger-hermetic.mjs`, permits only `anchor.ainumbers.co`) — a new live network call anywhere else fails CI. The Worker repo's `scripts/gate-zero-egress.mjs` is **kernel-scoped and worker-side**; it does not cover `tools/` pages, and MUST NOT be cited as if it did.

---

## 🧭 Amendment A5 — Single Source of Truth + conformance-by-construction (v1.4 → v1.5)

**Date:** June 2026. **RFC 2119: MUST.**

### A5.1 · The standard lives in one place
The normative OpenChainGraph standard is **`repo/chaingraph/standard/SPEC.md`** + **`openchain-graph-v0.4.schema.json`** (the machine schema). The published `openchain-graph-spec.html` renders it, the GitHub Pages mirror copies it, `chaingraph.json` + kernels validate against the schema, and **this contract references it — it does not restate it.** When any surface disagrees with SPEC.md, **SPEC.md wins and the disagreement is a CI failure.** The single version of record is `chaingraph.json.spec_version`.

### A5.2 · "Compliant" has a runnable definition
A tool, node, chain, kernel, or surface is **v0.4-compliant iff it passes the SPEC.md §15 conformance-gate suite** — not "matches someone's reading of the docs." The gates (CI-blocking): `kernel-hash-integrity` · `lint-forbidden-hash` · `golden-parity` · `kernel-coverage --strict` · `kernel-contract` · **`hash-sweep`** (post-deploy) · **`verify-mcp-registered`** (post-deploy) · `check-tool-names` · `validate-chains` · `smoke-mcp` · **`schema-validate`** · **`spec-version-consistency`** · **`surface-parity`** · **`catalog-parity`** · **`spec-gate-coverage`** (meta).

### A5.3 · Surfaces are generated, never hand-typed (Addendum A)
`mcp.html`, `chaingraph-hub.html`, sitemap, `llms.txt`, and the MCP tool/resource/prompt registrations are **generated from `chaingraph.json`** (+ `counts.json`). Displayed counts MUST be injected from `counts.json` (`data-ocg-count` tokens); hand-typing a count is a `surface-parity` failure. The three access layers map to MCP primitives: browser tools = **Resources**, compute kernels = **Tools**, named chains = **Prompts**.

### A5.4 · No rule without a gate (meta)
A normative MUST may not be added to SPEC.md without a referenced gate in the §15 matrix; `spec-gate-coverage` enforces this. This is the institutional fix for the recurring "documented but not enforced" drift (the hash-remediation and Wave-14/15-registration incidents).

### A5.5 · This contract's scope
CONTRACT.md now covers **AINumbers-specific build/deploy** rules only — file layout (§0–§1, §5), UI/PII (§1–§3), export tiers (§4), QA pipeline (§6), and deploy invariants (§A4). The **artifact envelope, execution_hash rule, mandate_type taxonomy, Compute Binding, and Export Profiles are normative in SPEC.md** (§A5.1), referenced here, not duplicated.

---

## Amendment A7 — Ledger subdomain storage carve-out (July 2026)

`ledger.ainumbers.co` subdomain: IndexedDB/localStorage PERMITTED, local-only, zero transmission, export/import mandatory, local-only statement on every ingress surface. Main-site storage prohibition (§0 Immutable Hard Constraints) unchanged.

### A7.1 · Scope
The `ledger/` directory in the site repo is the ONLY surface covered by this carve-out. All `tools/`, `guides/`, and root pages remain subject to the §0 storage prohibition.

### A7.2 · Hermetic gate
`scripts/check-ledger-hermetic.mjs` enforces that `ledger/index.html` makes NO network calls except `https://anchor.ainumbers.co` (the §6 user-initiated anchor-then-share call). This gate is wired into `scripts/preflight.mjs` and CI.

---

## Amendment A8 — MCP Playground egress carve-out (July 2026)

`mcp-playground.html` (`START-INFRA-BUILD-SPEC.md` §6, SI-6) is a hand-rolled JSON-RPC client against the live MCP Worker. An MCP playground that cannot call the MCP server is a JSON formatter — this amendment is the same shape as §A7's `ledger/` carve-out, scoped to one page and one host.

### A8.1 · Scope
`mcp-playground.html` MAY call exactly **one host**, `https://mcp.ainumbers.co`, and no other. The call MUST be **user-initiated only** — no on-load `fetch`, no auto-fire loops, no polling. No credentials, no PII, and no client storage (`sessionStorage`/`localStorage`/`cookies`/`IndexedDB`) — §0's storage prohibition is unchanged for this page; A8 relaxes egress only, not storage. Every other `tools/`, `guides/`, `chaingraph/`, and root page remains bound by §0 *Runtime* and §A4.7's browser-side zero-egress constraint, unchanged and unaffected by this section.

### A8.2 · Hermetic gate
`scripts/check-playground-hermetic.mjs` enforces that `mcp-playground.html` makes NO network calls except `https://mcp.ainumbers.co`. Modeled on `check-ledger-hermetic.mjs` (§A7.2). Until SI-6 ships the page, the gate exits 0 with a "not yet built" notice rather than failing on a missing file; once the page exists, the gate polices *what* it calls, not whether it calls anything. Wired into `scripts/preflight.mjs` and CI, same as §A7.2.

### A8.3 · Registration, not duplication
`mcp-playground.html` is added to `scripts/check-site-egress.mjs`'s lawful-exception list (`ALLOWLIST_FILES`) alongside `ledger/`'s `ALLOWLIST_PATHS` entry — the broad site-wide static egress scan (§A4.7 enforcement note) excludes it because the narrower §A8.2 gate already covers it precisely. This is registration in the existing allowlist, not a second detection mechanism.

### A8.4 · CSP and worker CORS are separate concerns, not covered here
The per-page CSP `connect-src` for `mcp-playground.html` and any Worker-side CORS change needed for a browser origin are SI-6's own build concerns (`check-csp-consistency.mjs`; CONTRACT §A4 same-push rule if the Worker changes). This amendment governs the egress carve-out only.

---

**END OF CONTRACT**  
*This document is version-controlled. All deviations require a formal spec amendment and consensus from Post Oak Labs Engineering & Compliance leads.*