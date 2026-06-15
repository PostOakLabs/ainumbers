# 📜 AINumbers.co — Unified Build Contract v1.3
**Maintainer:** Post Oak Labs · **Status:** Production-Ready · **Effective:** May 2026 · **v1.2 (Amendments A1–A2 folded):** June 2026 · **v1.3 (Amendment A3 — ChainGraph sole orchestration surface):** June 2026  
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
| MCP / manifest disclosure | `.mfst-btn` (or inline-styled equiv.) → `#mfstBody` / `#mfstCode`, wired by `toggleMfst()` | **Exactly one** collapsible toggle per tool, placed before the footer; lazy-renders the tool's `MANIFEST` object as formatted JSON. Legacy `.mcp-toggle` / `.mcp-panel` / `toggleMCP()` patterns are prohibited. |
| PII Banner | `.pii-notice` | Placed on identifier inputs (IBAN, BIC, LEI, etc.) |

> **MCP / manifest disclosure (standardized 2026-06-11).** Tools expose `manifest.json` through a single `mfst` toggle: `.mfst-btn` (or an inline-styled equivalent) placed before the footer, controlling `#mfstBody` / `#mfstCode`, opened by `toggleMfst()` which lazy-renders `JSON.stringify(MANIFEST, null, 2)`. The inline `MANIFEST` const is the single source of truth. The legacy `.mcp-toggle` / `.mcp-panel` / `#mcpPanel` / `toggleMCP()` button-and-panel pattern is RETIRED and MUST NOT appear in new or existing tools. Pattern unified with sister suite Apex Logics; swept via `standardize_mcp_toggle.py`.

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

**Context:** AINumbers shipped two multi-tool orchestration surfaces (Scenario Guides + Live Workflows; and Composer Runners, arch #4) alongside the hash-anchored `chaingraph/` suite. A dual surface confuses market participants and dilutes the M&A thesis. **Decision: collapse to one surface — ChainGraph — and make verifiable hash-chaining a contract-level MUST.**

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

The canonical orchestration artifact is the CHAINGRAPH §4 schema. Every ChainGraph node tool and chain page MUST emit it; `execution_hash` and the `chain` block are **REQUIRED** (they were optional under §3.1):

```json
{
  "ap2_version": "1.0.0",
  "mandate_type": "<§4 taxonomy — see A3.5>",
  "tool_id": "<kebab-case>",
  "tool_version": "1.0.0",
  "generated_at": "<ISO 8601>",
  "execution_hash": "<SHA-256 over canonicalized policy_parameters + output_payload>",
  "chain": {
    "parent_hashes": ["sha256:<upstream execution_hash>"],
    "parent_tool_ids": ["<tool_id of each parent>"],
    "chain_depth": 0
  },
  "policy_parameters": { "execution_backend": "webgpu|cpu-fallback|js", "input_parameters": {} },
  "output_payload": {},
  "compliance_flags": [],
  "audit_signature": { "client_side_executed": true, "zero_pii_verified": true, "deterministic_run": true }
}
```

**Rules (MUST):** `execution_hash` = WebCrypto `crypto.subtle.digest('SHA-256', …)` over **canonicalized** (sorted-key, whitespace-stripped) JSON of `policy_parameters` + `output_payload`; no library. Root artifacts use `parent_hashes: []`, `chain_depth: 0`. A consuming tool MUST copy each parent's `execution_hash` into `parent_hashes` and set `chain_depth = max(parent depths)+1`. Any chain MUST be independently re-verifiable: re-run the parent with the same inputs, recompute the hash, confirm the citation.

### A3.3 · Single surface; deprecations (RFC 2119: MUST)

- `/chaingraph/` is the **sole** orchestration namespace. Chain pages at `/chaingraph/chains/<id>.html`; nodes at `/chaingraph/<code>-<slug>.html`; hub at `/chaingraph/chaingraph-hub.html`.
- **DEPRECATED and removed** on conversion: page architecture #4 (Composer Runner), the Scenario Guide type, the Live Workflow type, and the 3 Diagnostic pages (rebuilt as single-node ChainGraphs). **Hubs are retained** as category navigation.
- Deprecated pages are **hard-removed** (no 301 redirects). The `guides/` directory retains only hubs + explicitly-kept utility/demo pages (`regression-replayer.html`, `mcp-agent-demo.html`).

### A3.4 · No duplication (RFC 2119: MUST)

A capability MUST exist in exactly one place. When a chain step is already served by a catalog tool, that tool is **promoted** (moved to `/chaingraph/`, given the §4 artifact, removed from `repo/tools/` + catalog). Any catalog tool whose function is **fully covered** by a ChainGraph node MUST be retired once that coverage is live and parity-checked — there is **no catalog/node twin**. A catalog tool remains in `/tools/` only if no node covers its function.

### A3.5 · mandate_type taxonomy + crosswalk (RFC 2119: MUST)

ChainGraph artifacts use the **§4 internal taxonomy** (`prompt_template`, `payment_mandate`, `payment_policy`, `compliance_mandate`, `liquidity_mandate`, `capital_assessment`, `risk_control`, `settlement_mandate`, `infrastructure_mandate`, `credit_assessment`, `treasury_mandate`, `account_mandate`, `model_governance`, `attestation_mandate`, `cryptographic_mandate`, `aml_rule`, `risk_parameter`). This is an **internal AINumbers taxonomy, not AP2 v0.2 spec vocabulary** — state that on the hub and in any tool whose name includes "AP2."

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

**END OF CONTRACT**  
*This document is version-controlled. All deviations require a formal spec amendment and consensus from Post Oak Labs Engineering & Compliance leads.*