# 📜 AINumbers.co — Unified Build Contract v1.0
**Maintainer:** Post Oak Labs · **Status:** Production-Ready · **Effective:** May 2026  
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
| **Client Storage** | **Forbidden:** `localStorage`, `cookies`, `IndexedDB`, any PII-adjacent cache. **Permitted:** `sessionStorage` **only** for `ain_lang` UI preference. All other state is in-memory. | Aligns with ePrivacy session-scoping norms; preserves tab-close data wipe. |
| **Routing & URLs** | Internal cross-links **MUST** use relative paths (`../tools/...`). Absolute URLs reserved **strictly** for `suite-registry.json` and external MCP endpoints. | Build-time resilience + portability; prevents broken links on staging/mirrors. |

---

## 🌐 1. Global UI & Accessibility Contract
### 1.1 Multilingual Toggle (WCAG 2.2 Compliant)
- **Container:** `<div class="lang-bar">`
- **Elements:** `<button class="lang-btn">` (NOT `<a>` tags). State-changing controls MUST use `<button>` per WCAG §4.1.2.
- **Sequence:** `EN · ES · FR · AR · PT · 中文`
- **Behavior:** `onclick="setLang('xx')"` must visibly update UI chrome text, flip `dir="rtl"` for Arabic, and persist via `sessionStorage.setItem('ain_lang', lang)`.
- **Scope:** Translates UI chrome only. Regulatory citations, ISO/SWIFT codes, JS logic, Policy Mandate keys, and tool-generated output remain in English.

### 1.2 Mandatory UI Components
| Component | Selector/Pattern | Notes |
|---|---|---|
| Language Bar | `.lang-bar > .lang-btn` | Placed top of file, above tool title |
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

---

## 📤 4. Export Tier System
Prevents client-side bloat & enforces deterministic guarantees.

| Tier | Formats | Requirement |
|---|---|---|
| **Tier 1 (Mandatory)** | `Policy Mandate JSON` + `Markdown` | All policy, rule, mandate, routing, compliance, or calculator tools |
| **Tier 2 (Conditional)** | `CSV` | Tools with tabular/batch/reconciliation outputs |
| **Tier 3 (Opt-in)** | `SVG` / `PDF` / `Nygard ADR` | Only when explicitly requested in tool brief or requires visualization/memo output |

*Implementation:* All exports MUST use `URL.createObjectURL(new Blob([content], {type:'...'}))` + `<a download>`. No external libraries (jsPDF, etc.) unless explicitly approved & bundled inline.

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

**Rules:**
- Never reset, never reuse RESERVED numbers.
- T300 deliberate architectural break from T268 is documented and permitted.
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
- [ ] `.lang-bar` with `<button>` toggles, full 6-language set, RTL CSS block
- [ ] Metadata badges in header/footer
- [ ] PII banner on identifier inputs (exact text per §1.3)
- [ ] All cross-tool links use relative `../tools/` paths
- [ ] Zero external scripts, CDNs, APIs, or network calls
- [ ] Financial/regulatory claims have numbered citations
- [ ] Input validation covers empty, negative, non-numeric, malformed
- [ ] Export output matches Tier system contract
- [ ] Complex logic & payments math are inline-commented
- [ ] `sessionStorage` used ONLY for `ain_lang`

### 6.2 Pre-Merge Validation Pipeline
```bash
# Validate all manifests against schema
npm run lint:manifests
# Verify Policy Mandate schema compliance on generated payloads
npm run test:ap2-exports
# Enforce UI placement rule via DOM inspection tests
npm run test:ui-ap2-placement
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
- [ ] Stage 2 i18n: full `TRANSLATIONS` object, `setLang()` implementation, RTL flip
- [ ] Deterministic output verified across 3 identical runs

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

### B. i18n Stage 2 Template Snippet
```html
<div class="lang-bar">
  <div class="lang-inner">
    <button class="lang-btn active" onclick="setLang('en')">EN</button>
    <button class="lang-btn" onclick="setLang('es')">ES</button>
    <button class="lang-btn" onclick="setLang('fr')">FR</button>
    <button class="lang-btn" onclick="setLang('ar')">AR</button>
    <button class="lang-btn" onclick="setLang('pt')">PT</button>
    <button class="lang-btn" onclick="setLang('zh')">中文</button>
  </div>
</div>
<script>
const TRANSLATIONS = { en: { /* keys */ }, es: {}, fr: {}, ar: { lang_dir: "rtl" }, pt: {}, zh: {} };
function setLang(lang) { /* full implementation from §1.1 */ }
(function initLang() { /* restore from sessionStorage */ })();
</script>
```

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