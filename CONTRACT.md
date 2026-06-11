# 📜 AINumbers.co — Unified Build Contract v1.2
**Maintainer:** Post Oak Labs · **Status:** Production-Ready · **Effective:** May 2026 · **v1.2 (Amendments A1–A2 folded):** June 2026  
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
| MCP Panel | `.mcp-toggle` / `.mcp-panel` | Embedded `manifest.json` block |
| PII Banner | `.pii-notice` | Placed on identifier inputs (IBAN, BIC, LEI, etc.) |

### 1.3 Unified PII Banner Text
```text
🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.
```
*All tools MUST use this exact phrasing for legal consistency.*

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

> **Naming note:** AINumbers' Policy Mandate schema is AINumbers' own structured-mandate format for compliance, regulatory, and policy artifacts. It is **NOT** Google's Agent Payments Protocol (AP2). Real AP2 (see [ap2-protocol.org](https://ap2-protocol.org/)) defines IntentMandate / CartMandate / PaymentMandate for agent-mediated payment flows — a different problem domain. AINumbers tools whose names include "AP2" (102, 320, 323, 326) operate in the AP2 problem domain but emit AINumbers Policy Mandates describing assessments and policies *about* AP2 use cases — they do not emit real AP2 mandates. The internal JS identifier `AP2Schema`, button id `ap2ExportBtn`, and manifest flag `ap2_export` are legacy names kept for stability.

Adopted for human-readable audit + machine-agent ingestion. `execution_hash` added as optional audit metadata.
```json
{
  "ap2_version": "1.0",
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

### 5.3 Orchestrated Workflow Runner pages (page architecture #4) — Amendment A1.4
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
```bash
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
**END OF CONTRACT**  
*This document is version-controlled. All deviations require a formal spec amendment and consensus from Post Oak Labs Engineering & Compliance leads.*