# 📜 AINumbers.co — Unified Build Contract v1.8
**Maintainer:** Post Oak Labs · **Status:** Production-Ready · **Effective:** May 2026 · **v1.2 (Amendments A1–A2 folded):** June 2026 · **v1.3 (Amendment A3 — ChainGraph sole orchestration surface):** June 2026 · **v1.4 (Amendment A4 — MCP deploy & tool-registration invariants):** June 2026 · **v1.5 (Amendment A5 — SPEC.md SSOT + conformance-by-construction):** June 2026 · **v1.6 (Amendment A6 — reader-facing copy style):** July 2026 · **v1.7 (Amendment A7 — ledger subdomain storage carve-out):** July 2026 · **v1.8 (Amendment A10 — Policy Mandate v1.1 `caveats` member):** August 2026  

> **SSOT for the OpenChainGraph standard = `repo/chaingraph/standard/SPEC.md`** (+ `openchain-graph-v0.4.schema.json`). This contract references it, does not restate it (Amendment A5). Conformance = the SPEC.md §15 gate suite.
**License:** CC BY 4.0 · **Scope:** All browser-based financial tools, hubs, and MCP integrations  
**Target Audience:** AI Build Instances (Claude/LLMs), Frontend Engineers, Compliance QA  

---

## 📖 How to Use This Document
This is the **Single Source of Truth (SSOT)** for all AINumbers.co builds. It supersedes all prior fragmented specs, resolves identified contradictions, and enforces May 2026 best practices for client-side deterministic architectures, MCP v1+ compatibility, WCAG 2.2 accessibility, and GDPR/ePrivacy session-scoping norms.  
**Read in full before generating any HTML, JSON, or UI component.**

> §0–§6 carry the normative rules only. The explanatory prose, precedent notes and audit history behind them live verbatim in **`CONTRACT-RATIONALE.md`**, section-numbered identically and linked from each section it covers. Reading it is optional.

---

## 🔒 0. Immutable Hard Constraints (RFC 2119: MUST)
| Constraint | Specification | Rationale |
|---|---|---|
| **Architecture** | Single self-contained `.html` per tool. All CSS/JS inline. Google Fonts only (`DM Serif Display`, `Sora`, `JetBrains Mono`). | Zero build step, zero dependency drift, portable static deployment. |
| **Runtime** | Synchronous, deterministic execution. Zero `fetch`, `async`, `WebWorker`, or external network calls after page load. Seeded PRNG allowed *only* for synthetic data. | Ensures bit-for-bit reproducible outputs across sessions and clients. |
| **Data Safety** | **Zero PII** collected, stored, logged, or transmitted. Input sanitization strips identifiable fields. Output schemas exclude personal data. | Compliance-first design; eliminates regulatory liability. |
| **Client Storage** | **Forbidden:** `localStorage`, `cookies`, `IndexedDB`, `sessionStorage`, any PII-adjacent cache. All state is in-memory. (`ain_lang` sessionStorage exemption removed — lang toggle deferred; see §1.1.) | Aligns with ePrivacy session-scoping norms; preserves tab-close data wipe. |
| **Routing & URLs** | Internal cross-links **MUST** use relative paths (`../tools/...`). Absolute URLs reserved **strictly** for the generated registry surfaces (`.well-known/mcp.json`, `mcp/catalog.json`, `mcp/server.json` — §2.1) and external MCP endpoints. | Build-time resilience + portability; prevents broken links on staging/mirrors. |
| **Content Security Policy** | Every `tools/`, `guides/`, and `chaingraph/` page **MUST** carry a `<meta http-equiv="Content-Security-Policy">` tag matching one of three canonical profiles: `CSP_STANDARD` (static tool/doc pages, no worker/iframe), `CSP_WASM_VM` (pages instantiating a Worker/wasm VM), `CSP_COMPOSER` (Orchestrated Workflow Runner pages and ChainGraph chain pages, §5.3/A3.1, needing `frame-src 'self'` for the same-origin bridge iframe). Enforced by `scripts/check-csp-consistency.mjs` (gates both drift from a profile and absence of a tag; ratchet-only baseline, counts only go down). | No server- or edge-level CSP header exists anywhere in the deploy stack (Cloudflare, `.htaccess`, DreamHost) — the meta tag is the **sole** CSP mechanism, so a missing tag is an absent security control, not redundancy. |

---

## 🌐 1. Global UI & Accessibility Contract
### 1.1 Multilingual Toggle — DEFERRED (Option A)
The lang toggle (`.lang-bar` / `setLang()`) has been **removed from all new builds** as of June 2026. The existing toggle on live tools was cosmetic only — it did not translate content, providing no value and a misleading UX for the target audience.

**Do not add a lang toggle to new tools or hubs.** Do not include `.lang-bar` CSS, `setLang()`, `TRANSLATIONS` objects, or `sessionStorage` `ain_lang` writes in any new file.

**Grandfathered state (existing tools):** tools built before this amendment retain `.lang-bar` HTML and/or `TRANSLATIONS` JS in their source. **The count is not recorded here — derive it:**

```
git grep -l 'lang-bar'     -- 'tools/*.html' | wc -l   # pages still carrying the toggle markup
git grep -l 'TRANSLATIONS' -- 'tools/*.html' | wc -l   # pages still carrying the translation tables
python scripts/strip_lang_toggle.py                    # dry-run; prints "clean / needs-review / unchanged"
```

*(This replaced a bare "~187", which was undated and unreproducible. The three commands answer three different questions and on 2026-08-23 returned 159, 262, and "clean: 27, needs-review: 5" respectively — no single literal can stand for that, which is why the predicate is now named alongside the instrument. Enumerate with `git grep`/`git ls-files`, never a directory walk: this workspace holds many worktrees and a recursive walk inflates the denominator.)* The AIN Bridge `t()` function in these tools has been pinned to English-only (sessionStorage read removed, Amendment A2). Do not strip their `TRANSLATIONS` blocks until I18N-SPEC.md Option B is ready to replace them; use `scripts/strip_lang_toggle.py --write` at that point. (rationale: `CONTRACT-RATIONALE.md` §1.1)

### 1.2 Mandatory UI Components
| Component | Selector/Pattern | Notes |
|---|---|---|
| Input Panels | `.panel` / `.panel-label` / `.panel-row` | Semantic grouping, explicit `<label>` pairing |
| Run Button | `.run-btn` | Disabled loading state during sync calculation |
| Results Container | `.results-panel` | Hidden by default, revealed post-calculation |
| Export Container | `.results-export-row` | Legacy alias: `.arow { @extend .results-export-row; }` |
| MCP / manifest disclosure | `.mfst-btn` (or inline-styled equiv.) → `#mfstBody` / `#mfstCode`, wired by `toggleMfst()` | **Exactly one** collapsible toggle per tool, placed before the footer; lazy-renders the tool's `MANIFEST` object as formatted JSON. Legacy `.mcp-toggle` / `.mcp-panel` / `toggleMCP()` patterns are prohibited. |
| PII Banner | `.pii-notice` | Placed on identifier inputs (IBAN, BIC, LEI, etc.) |

> **MCP / manifest disclosure (standardized 2026-06-11).** Tools expose `manifest.json` through a single `mfst` toggle: `.mfst-btn` (or an inline-styled equivalent) placed before the footer, controlling `#mfstBody` / `#mfstCode`, opened by `toggleMfst()` which lazy-renders `JSON.stringify(MANIFEST, null, 2)`. The inline `MANIFEST` const is the single source of truth. The legacy `.mcp-toggle` / `.mcp-panel` / `#mcpPanel` / `toggleMCP()` button-and-panel pattern is RETIRED and MUST NOT appear in new or existing tools. (rationale: `CONTRACT-RATIONALE.md` §1.2)

### 1.3 Unified PII Banner Text
```text
🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.
```
*All tools MUST use this exact phrasing for legal consistency.* This banner is the **one sanctioned em-dash** in reader-facing copy; the §1.4 copy-hallmarks gate exempts its exact string verbatim.

### 1.4 Reader-Facing Copy Style (Amendment A6)
Public HTML pages and the `chaingraph.json` descriptions served to agents are read by outside practitioners; their prose MUST NOT read as machine-generated. The following are **hard rules**, gated by `scripts/check-copy-hallmarks.mjs` (preflight + CI):

- **No em-dashes (—) in human-visible HTML text or in `chaingraph.json` node/chain descriptions.** Rewrite by context: `label — value` → `label: value`; a parenthetical aside → commas or parentheses; a sentence splice → a period, colon, semicolon, or comma. En-dashes (–) in numeric ranges are correct typography and stay. The §1.3 PII banner is the sole exempt em-dash (stripped by the gate verbatim).
- **No double-hyphen em-dash substitutes (` -- `, ` --- `) in human-visible HTML text or in `chaingraph.json` descriptions (Tim, 2026-08-02).** Use the rewrites above (colon, comma, semicolon, period, parentheses). **A single hyphen is not a substitute either** — in prose it reads as a typo or a broken compound. Exempt: `<code>`/`<pre>` bodies and CLI examples (already stripped by the gate), and `<option>` placeholder dividers of the form `-- Select … --`, an established HTML convention rather than prose.
- **Entity-encoded em-dashes count as em-dashes (Tim, 2026-08-02).** `&mdash;`, `&#8212;`, and `&#x2014;` render as the same character, so the gate MUST decode named and numeric entities before counting. Encoding an em-dash is a violation, not a workaround. Same rule for entity-encoded hyphens (`&#45;`, `&#x2D;`) in the double-hyphen check.
- **No internal build codes in visible prose:** `Wave N`, `W-A`…`W-G`, standalone `D0`. Rewrite the sentence plainly. `ART-xx` / `T-xxx` node ids remain allowed in small monospace metadata lines and technical contexts.
- **No AI rhetorical tics:** telegraphic "It is not X. It is Y." twotone constructions, punchy `X, not Y` card fragments, and defensive meta-phrasing ("no workflow fabricates details…"). Keep contrasts that carry real technical meaning; rewrite the conspicuous ones plainly.
- **The reasonable-reader test for negations (Tim, 2026-08-17).** A negation may appear only where a reasonable reader would otherwise assume the opposite. The basis is Google developer-documentation style guide: a non-scope section covers only what users would reasonably expect the document to cover. Lead with positive scope ("This page verifies X against Y"). A limitation lives inline, next to the claim it bounds, as one sentence. At most two limitation sentences per page unless a regulator or standard literally requires more, in which case cite it. No "SCOPE", "What this does not do", "Non-goals", "Out of scope" or "Limitations" boxes: a heading followed by a wall of negation bullets is the house tic this rule exists to remove, measured at 631 of 1,855 pages on 2026-08-17. Never enumerate things nobody would expect the page to do. This governs authored prose only. The disclaimers this CONTRACT mandates stay verbatim, including the 1.3 PII banner and any "not legal advice" line the estate already requires.
- **No italic/bold emphasis in HEADINGS (Tim, 2026-07-20).** `<em>`/`<i>`/`<strong>`/`<b>` inside `h1`-`h6` (including the old two-tone `tool-title <em>Word</em>` pattern) is now a blocking tell, not exempt design styling. Headings render single-color, single-weight. Structural bold in `th`/`dt`/`label`/`legend`/`button` stays exempt (UI chrome, not prose). Body-prose italics were already banned.
- **Guide hubs carry an audience statement** (who the hub is for), in plain prose.
- **In user-facing prose, call OpenChainGraph chains "workflows."** Slugs, file paths, `chaingraph.json` identifiers, and the OpenChainGraph standard vocabulary in `standard/` are unaffected.
- **Date-bearing compliance claims** (regulatory deadlines, enforcement dates) must distinguish obligation-applicability from enforcement where they differ, cite the exact date, and carry an `as of <month year>` currency note plus a primary-source link. Applied on-touch, when a date claim is next edited, not a mandatory field on every tool and not a mass sweep.
- **Inlined SSOT copies are generated, never hand-typed.** The `secured()`, `securedRecord()`, and `__ocgCanon()` inline `<script>` blocks pasted into tool/guide/chaingraph pages must stay byte-identical to their kernel SSOT (`chaingraph/kernels/_proof.inline.min.js`, `_signverdict.inline.js`, `_hash.mjs`). Gate: `node scripts/check-inline-ssot-sync.mjs --check` (preflight + CI), manifest-driven from `scripts/inline-ssot-sync-manifest.json`; `scripts/inline-ssot-sync-baseline.json` pins already-known stylistic legacy variants only, never a behavioral difference.

**Gate mechanics.** `scripts/copy-hallmarks-baseline.json` holds not-yet-swept legacy debt (Tier 2/3 tool + guide + chain files, the hub CHAIN_INDEX grid, the tool-directory mirrors in `tools.html`/`sitemap.html`, and the `chaingraph.json#descriptions` bucket until Phase C). A baselined file may carry **at most** its recorded count, so counts only ever go down; any file absent from the baseline must be clean, so new hallmarks fail immediately. Regenerate the baseline with `--update` **only** for a deliberate, reviewed exception, never to paper over a regression. (rationale: `CONTRACT-RATIONALE.md` §1.4)

### 1.5 Node-Page Result Provenance (August 2026)

**Scope: node pages, `chaingraph/art-*.html`.** This section governs how a node page *presents* values it already holds. It adds nothing to the OpenChainGraph envelope, which is normative in SPEC.md (§A5.1/§A5.5). A page **MUST NOT** satisfy any rule here by changing what a kernel emits, by adding or removing an artifact field, or by altering the `execution_hash` preimage `{policy_parameters, output_payload}`. If a rule here appears to require a kernel or envelope-shape change, the rule is not what needs the change: stop and raise it.

**Enforcement: `DISCIPLINE` — there is no gate for §1.5 (marked honestly, 2026-08-23).** No script in `scripts/` asserts §1.5.1 or §1.5.2; both rules are held by review and by the authoring row, not mechanically.

> **Why this says DISCIPLINE and not a gate name.** Earlier revisions named `scripts/check-node-page-chrome.mjs` as this section's gate. **That gate does not assert anything in §1.5.** It checks site chrome only — exactly one canonical `<nav>` and `<footer>`, the required nav/footer tokens, a non-empty breadcrumb span, the footer `Spec v…` label, and the CSS marker. It never inspects `generated_at`, a results panel, or a decision value; `preflight.mjs` itself lists it as *"Node-page chrome (nav/footer)"*. Naming a gate that does not assert the rule is worse than naming none, because it stops anyone from looking. (The old line was stale twice over: it also described the gate as *"scoped to `chaingraph/art-*.html`"*, which `GUIDE-CHROME-AUDIT-1` widened to all `chaingraph/*.html` on 2026-08-17.)
>
> **This is not a licence to add one.** The standing instruction below is unchanged: **no new gate, script, baseline, or dependency is to be created for §1.5.** If §1.5 is ever mechanized, the assertions belong in a gate that actually reads a results panel — and this line gets replaced by its name, not supplemented with it. Until then `DISCIPLINE` is the accurate word, and SO #34c applies: a missing gate result is a distinct state, never a green one. (rationale: `CONTRACT-RATIONALE.md` §1.5)

#### 1.5.1 `generated_at` MUST be visible (RFC 2119: MUST)

- A node page that constructs `generated_at` into its exported artifact **MUST** also render that timestamp in its results panel. A page that renders no results panel is out of scope; a page that exports an artifact is not.
- The rendered timestamp and the exported `generated_at` **MUST** be the **same value**, captured **once**, at the moment the run completes. A page **MUST NOT** call the clock a second time when building the export.
  - *Fallback, so no build row stalls on this.* Where a page cannot move its capture point without touching a signing or export path outside the row's fence, it **MUST** still render the exact value it exports, and **MUST** record the deviation on its row rather than shipping two timestamps.
- **Format: ISO 8601 UTC**, the value of `Date.prototype.toISOString()`, rendered verbatim. The v0.4 schema types the field `string` and describes it as ISO 8601; a page **MUST NOT** substitute a locale-formatted or relative rendering ("2 minutes ago") for the machine value. A locale rendering **MAY** accompany it.
- **Placement:** inside the results panel, after the verdict block and before the statistics row, labelled so a reader knows what the timestamp refers to. Reuse the established affordance: the class shape of `.verify-banner` in `deadline-wall.html`, and the markup shape of `art-525-nway-balance-closure-check.html:181` (`<div class="generated-at" id="generatedAt"></div>`). **Do not invent new chrome for this.**
- A page that carries no `generated_at` at all is a separate defect and is **not** repaired by this section. (rationale: `CONTRACT-RATIONALE.md` §1.5.1)

#### 1.5.2 A rendered decision MUST show every state it can reach (RFC 2119: MUST)

Where a node page renders a decision, status, verdict, or classification value at all:

- It **MUST** render the value the computation actually produced, read from the field. It **MUST NOT** map that value through a fixed two-outcome affordance when the computation can produce three or more states.
- It **MUST NOT** hardcode a state vocabulary. A page **MUST** render the states its own computation can reach, and **MUST NOT** advertise a state that computation never emits.
- **All existing decision-pointer shapes are accommodated as they stand.** **Normalising decision pointers is NOT a precondition of §1.5, and a page MUST NOT be normalised in order to satisfy it.**
- Distinguishability is the requirement, not colour. Two states **MUST NOT** be rendered identically. Colour alone **MUST NOT** be the sole carrier of the distinction (§1 accessibility): the state's own value, or a label derived from it, is rendered as text.

A page **MUST NOT** be given a badge for a state it does not compute in order to close a divergence finding; that hides the divergence instead of reporting it. (rationale: `CONTRACT-RATIONALE.md` §1.5.2)

---

## 🤖 2. Machine-Readable Registry & MCP Contract
### 2.1 File Naming & Scope Separation

The registry surfaces are **generated, never hand-written** — `python scripts/regen_catalog.py` is their single writer (§A5.3). Each generated file carries its own `generated` / `last_updated` date and its own `tool_count`: **read the count from the file, never from this contract.**

| File | Purpose | Location |
|---|---|---|
| `.well-known/mcp.json` | Root discovery shim (`schema_version: well-known-mcp-v1`) — points external agents at the servers, `llms.txt` and the sitemap | `.well-known/` |
| `mcp/catalog.json` | **Suite-level MCP registry consumed by external agents** (`schema_version: mcp-catalog-v1`) — the full tool array; see §2.3 | `mcp/` |
| `mcp/server.json` | Server descriptor (`schema_version: mcp-server-v1`) — publisher, endpoints, categories, standards covered | `mcp/` |
| `<tool_id>.manifest.json` | Per-tool / **per-node** manifest, machine-read by the worker build | `manifests/` (flat) — see §2.7 |

> **Historical correction (2026-08-23).** Earlier revisions of this section named a root `suite-registry.json` as the suite-level registry, and a per-tool `manifest.json` under `tools/XX-slug/`. **Neither has ever existed.** `suite-registry.json` was never committed on any ref — `git rev-list --all --objects` matches it zero times across the whole history — and `tools/` is a flat directory of `.html` files with no per-tool subdirectories (`git ls-files 'tools/*/*'` → 0). The roles those names described are filled by `mcp/catalog.json` and `manifests/<tool_id>.manifest.json` respectively. **Do not "restore" either file:** the correct action on encountering a stale reference is to repoint it at the real surface above.

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
- All tools appear in `mcp/catalog.json` (§2.3) regardless of `ap2_export` value.

### 2.3 Suite-Level `mcp/catalog.json` Structure

**Generated by `python scripts/regen_catalog.py` — never hand-edited.** The live file is the SSOT for its own shape and count; the skeleton below records the top-level key set only.

```json
{
  "schema_version": "mcp-catalog-v1",
  "server_id": "ainumbers-fintech-suite",
  "name": "AINumbers Fintech Intelligence Suite",
  "description": "…",
  "base_url": "https://ainumbers.co",
  "generated": "YYYY-MM-DD",       // written by the generator, not by hand
  "tool_count": 0,                 // authoritative value lives in the file
  "tools": [ /* array of tool objects mirroring the §2.2 manifest schema */ ]
}
```

`tool_count` and `generated` are **generator output, not contract constants** — to read them, read the file:

```
node -e "const c=require('./mcp/catalog.json');console.log(c.tool_count,c.generated)"
```

The companion `mcp/server.json` (`schema_version: mcp-server-v1`) carries the publisher block, `endpoints`, `categories`, `standards_covered` and its own `tool_count` / `last_updated`, on the same generated-not-authored basis.

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
node scripts/validate-chains.mjs
```
Missing tool/composer files are **errors** (non-zero exit → block deploy); chain↔composer sequence divergence prints as a **warning**. Paths default to the sibling `repo/` layout; override with `WORKER_PATH`, `TOOLS_DIR`, `GUIDES_DIR`. (rationale: `CONTRACT-RATIONALE.md` §2.5)

### 2.7 §2.2 reaches ChainGraph nodes — a live node owes a manifest with a declared `output_schema`

**Ruling (RFC 2119: MUST) — YES.** A **live `chaingraph.json` node with an `mcp_name`** is a registered MCP tool (§A4.1 registers exactly that set as tool names), and is therefore **in scope for §2.2**. It MUST have a manifest at **`repo/manifests/<tool_id>.manifest.json`** — keyed by `tool_id`, not by an `art-` filename prefix — and that manifest MUST declare an **`output_schema`** (§2.2).

**The file is the normative location.** `mcp-apps-poc/generate.mjs` resolves `repo/manifests/<tool_id>.manifest.json` and projects the declared `output_schema` into `data/mcp/output-schemas.json`, keyed by `mcp_name`, **omitting it entirely when no manifest exists — never fabricating one**. The inline `var MANIFEST` object on a node's ChainGraph page (referenced by the node JSON's `input_schema_ref`) remains the reader-facing disclosure required by §1.2 and is NOT a substitute: no generator parses it, so a declaration made only there reaches no agent.

**Scope boundaries — what this rule does NOT do:**
- It does **NOT** require normalising the decision/gate pointer shape. Each node declares **the shape it already emits**; the four shapes in use today (flat `decision` + `execution_state`; nested `decision.{gate_policy,execution_state}`; flat `gate_status`; `roles.partner.gate_status`) are each declarable as they stand, and **no shape is canonical**.
- It is **NOT** a hash-moving change and triggers **no re-proof**. Adding a manifest creates a new file and edits no kernel and no `output_payload`, so `execution_hash` is untouched (§A4.3). Any rule requiring a payload *reshape* would be a different, escalated change (§0).
- It adds **no new CI gate**. §A5.4's "no rule without a gate" governs SPEC.md MUSTs via `spec-gate-coverage`; this is a CONTRACT.md build duty.

**Truth maintenance (MUST).** A declared `output_schema` MUST be consistent with what the node's kernel actually emits, evidenced against the node's golden conformance fixture `output_payload`. Backfill SHOULD therefore derive schemas from the golden fixtures rather than compose them by hand.

**Obligation, staged — stated with its real size:**
- **New nodes (in force now):** every new live node ships `repo/manifests/<tool_id>.manifest.json` with an `output_schema` **in the same PR** as the node. Add it to the §6.1 pre-flight for any PR that adds a node. (rationale: `CONTRACT-RATIONALE.md` §2.7)

---

## 📦 3. AINumbers Policy Mandate Schema & UI Contract
### 3.1 AINumbers Policy Mandate v1.0 Schema (not AP2)

> **Naming note:** AINumbers' Policy Mandate schema is AINumbers' own structured-mandate format for compliance, regulatory, and policy artifacts. It is **NOT** Google's Agent Payments Protocol (AP2). AINumbers tools whose names include "AP2" (102, 320, 323, 326) operate in the AP2 problem domain but emit AINumbers Policy Mandates describing assessments and policies *about* AP2 use cases — they do not emit real AP2 mandates. The internal JS identifier `AP2Schema`, button id `ap2ExportBtn`, and manifest flag `ap2_export` are legacy names kept for stability. The in-payload `ap2_version` field (value `"1.0"`) is **retired as of v0.4** — it duplicated the schema version under an AP2-implying name and is no longer part of the canonical schema; `chaingraph_version` is the sole envelope version. (rationale: `CONTRACT-RATIONALE.md` §3.1)

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

### 3.1.1 AINumbers Policy Mandate v1.1 — the `caveats` member (Amendment A10)

**v1.1 = v1.0 plus one optional top-level member, `caveats`.** Nothing in §3.1 changes, is renamed, or is removed. The retained legacy identifiers (`AP2Schema`, `ap2ExportBtn`, `ap2_export`) are untouched.

```json
{
  "caveats": ["string", "string"]
}
```

**Why the member exists.** Caveat text already rides Policy Mandate exports, but it rides them *by accident*: there was no schema member and no intake contract, so nothing downstream could rely on it and nothing upstream was obliged to keep it. `caveats` makes it a term of the contract instead of a habit.

**Normative rules (RFC 2119).**

| # | Rule |
|---|---|
| **A10.1** | `caveats` is **OPTIONAL**. A document that omits it is **valid**. Its absence **MUST NOT** be reported as an error, and **MUST NOT** be reported as a warning. |
| **A10.2** | When present, `caveats` **MUST** be an array of non-empty strings. This is deliberately the same shape as the ChainGraph envelope's `compliance_flags` (`openchain-graph-v0.4.schema.json`: `array`/`items`/`string`), so a kernel's flags carry into a mandate verbatim with no lossy remapping at the boundary. |
| **A10.3** | A malformed `caveats` member **MUST** cause the **whole document** to be rejected. A validator **MUST NOT** silently accept it, and **MUST NOT** validate the document while dropping the member. |
| **A10.4** | `caveats: []` is **valid** and asserts **nothing**. A consumer **MUST NOT** read an empty array as "this assessment has no caveats". |
| **A10.5** | A v1.1 validator **MUST** accept every document a v1.0 validator accepts. v1.1 tightens **no** existing rule. Where shipped `AP2Schema` generations disagree on a rule, a v1.1 validator takes the **weakest** of them as its error set and reports the rest as warnings. |
| **A10.6** | `caveats` is **not** hashed content and has **no** `execution_hash` preimage impact. It is adjacent metadata, like `summary`. |

**Why A10.3 is strict while A10.1 is lenient — the leniency is spent where it is load bearing.** A v1.0 document has no `caveats` member to malform, so the strict ruling cannot break a single shipped exporter; its blast radius is confined to documents that opted in to v1.1. The rejected alternative — validate the document but drop the bad member — recreates the exact defect this amendment exists to end, one level up: a consumer receives a *valid* document whose caveats have silently vanished, at precisely the moment someone was relying on them.

**Reference validator:** `scripts/validate-policy-mandate.mjs`. Its paired gate, `scripts/validate-policy-mandate.test.mjs`, proves A10.5 **differentially** rather than by fixture: it lifts a shipped `AP2Schema` out of a tracked tool page at run time and asserts *shipped v1.0 accepts ⇒ v1.1 accepts* over a corpus built by that same shipped code. Both run in `scripts/preflight.mjs` and in CI.

**Adoption is a separate decision.** This section makes the contract; it does not oblige any exporter to emit `caveats`, and no `tools/` page changes as a consequence of it.

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

**`caveats` passthrough (Amendment A10, v1.1).** `caveats` is **not input data** and **MUST NOT** be mapped onto an element ID — it is provenance that travels with the artifact, not a value to prefill. The intake duty is a **carry** duty:

| # | Rule |
|---|---|
| **A10.7** | A tool that ingests a mandate and later exports one **MUST** carry the incoming `caveats` forward **byte-intact** — same strings, same order, unaltered. Re-ordering, de-duplicating, re-wrapping, truncating or summarising them is **forbidden**: the property that makes the member worth having is that a caveat which entered the chain can be found, unchanged, at the far end of it. |
| **A10.8** | A tool's own caveats are **appended after** the inherited ones. Inherited caveats are **never** replaced or overwritten. |
| **A10.9** | Absent stays absent. Intake **MUST NOT** synthesise `caveats: []` for a document that carried none — that would manufacture the empty-array non-assertion A10.4 warns about. |

Reference implementation of the carry duty: `carryCaveats()` in `scripts/validate-policy-mandate.mjs`.

---

## 📤 4. Export Tier System

| Tier | Formats | Requirement |
|---|---|---|
| **Tier 1 (Mandatory)** | `Policy Mandate JSON` + `Markdown` | All policy, rule, mandate, routing, compliance, or calculator tools |
| **Tier 2 (Conditional)** | `CSV` | Tools with tabular/batch/reconciliation outputs |
| **Tier 3 (Opt-in)** | `SVG` / `PDF` / `Nygard ADR` | Only when explicitly requested in tool brief or requires visualization/memo output |

**Scope (clarification, 2026-08-01):** the Export Tier table binds **`tools/` pages only** — a `chaingraph/` node carries **no Tier 2 CSV obligation** by virtue of having tabular, batch, or reconciliation output, and `art-NNN` node ids are a separate namespace from `tools/NNN` even where the numbers overlap.

*Implementation:* All exports MUST use `URL.createObjectURL(new Blob([content], {type:'...'}))` + `<a download>`. No external libraries (jsPDF, etc.) unless explicitly approved & bundled inline.

**Wave-5 tools (Amendment A2.2):** T465–T468 (CARF/DAC8/1099-DA crypto-tax) and T472, T475–T476 (Basel LCR/NSFR/Pillar 3, Pillar Two GloBE safe harbour) carry Tier 1 export obligation — their outputs are policy and compliance assessments covered by `compliance_control`, `risk_parameter`, and `disclosure_template` mandate types (§3.1). (rationale: `CONTRACT-RATIONALE.md` §4)

---

## 🔢 5. Tool Numbering & Hub Architecture
### 5.1 Canonical Ranges (Global & Sequential)

**What this table is, and is not.** The **T-ranges and the RESERVED/available notes are policy** — deliberate allocation decisions that do not decay, and the reason this table exists. The **"live" counts are not policy and are not authoritative here.** Derive the totals instead:

```
git ls-files 'tools/*.html' | wc -l                  # every tool page
node scripts/verify-counts.mjs --check               # deriveCounts(): tools.browser, categories, chains, mcp.live
node -e "const c=require('./mcp/catalog.json');console.log(c.tool_count,c.generated)"
```

`scripts/counts.mjs` `deriveCounts()` is the single derivation used by every published count sentinel (§6, `verify-counts.mjs`); a number that disagrees with it is wrong by definition. **Never hardcode a count to make a gate pass.**

**Numbering extends well past this table.** The per-category rows below stop at T318; allocation above that has been per-wave rather than per-category, and the table has deliberately not been extended row-by-row — enumerating ~280 further entries by hand would decay the day after it was written. As of 2026-08-23 the numbered tool pages span **T1–T665** (540 numbered files; 282 of them above T318), measured with:

```
git ls-files 'tools/*.html'   # parse the leading NNN- of each filename
```

The allocation rules below ("never reset, never reuse RESERVED") bind across the whole span, not only the rows listed.

| Category | T-Range | Status *(live counts as observed 2026-08-23; derive, do not cite)* | Notes |
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
- T380/T381 disambiguation (2026-06-11): T380 (`physical-climate-risk-assessor`) and T381 (`eu-green-bond-standard-screener`) are confirmed distinct tools. Do not merge or renumber.
- Cross-link, don't clone. Use Journey Track/Quick-Start for workflow routing.
- Drop tools marked DROPPED/CONSOLIDATED in the Overlap Registry. (rationale: `CONTRACT-RATIONALE.md` §5.3)

### 5.2 File Path Convention
- **Hub:** `guides/{category-slug}-hub.html`
- **Tool:** `tools/{number}-{kebab-slug}.html`
- **Index Update:** Add `data-cat="cat-XX"` to all tool cards in `index.html`. Update sidebar badges, hero stats, and MCP summary table rows.

### 5.4 The `start.html` intent-grid rule (Amendment, START-NAV-1; amended 2026-08-30)
`start.html`'s "Explore the suite" grid is **grouped by visitor activity, not by surface**: cards sit under short activity row-labels ("Run and build", "Verify and evidence", "Convert and inspect", "Connect", "Read") and link the surface that serves that activity — orchestration surfaces, verification tools, hubs, or guides — directly. This supersedes the original family-hub-only / 12-card-cap design: that redesign was deliberate, so the rule is amended to match the shipped page rather than the page reverted to the rule (the retirement-claims-without-readers class). A new entry joins the activity row matching what a visitor is trying to do; no founding hub page is required, and the card count is derived from the live page, never fixed here.

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
- [ ] `node scripts/regen-sitemap.mjs` run after adding any new tool or guide, leaving `node scripts/regen-sitemap.mjs --check` green (Amendment A2.3; supersedes `python scripts/regen_sitemap.py --apply`, quarantined as `scripts/regen_sitemap.py.DEPRECATED` for scanning only `tools/`, `guides/` and `chaingraph/` and silently dropping every published page outside that scope)

### 6.2 Pre-Merge Validation Pipeline
**`node scripts/check_tools.js` is the BLOCKING first gate** — it parses every tool's inline JavaScript and exits non-zero if any `<script>` has a syntax error. NEVER commit or merge tool HTML while it reports a failure; run `node scripts/locate_errors.js` to pinpoint each break.
```bash
# 0. JS syntax gate — MUST exit 0 (blocking; no tool may ship with a broken inline <script>)
node scripts/check_tools.js
# Validate all manifests against schema
node scripts/check-manifest-schema.mjs
# PII text, manifest coverage, AP2 export-button consistency, sitemap coverage (verify_repo.py's
# 5 checks — Check 3 is the AP2 export-button placement check; there is no separate payload-schema
# or DOM-placement test, this one command covers what were two dead npm targets)
python scripts/verify_repo.py
```
When MCP server chains change (`mcp-apps-poc/worker.mjs`), also run the chain-integrity validator before `wrangler deploy` (see §2.5):
```bash
cd mcp-apps-poc && node scripts/validate-chains.mjs
```
**SSOT conformance gates (Amendment A5)** — run from the site repo root before any push that touches `chaingraph.json`, the spec/hub HTML, `standard/`, or a kernel: (rationale: `CONTRACT-RATIONALE.md` §6.2)
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

### 6.5 Scheduled/report-only CI surfaces MUST surface their own reds (NIGHTLY-RED doctrine)
A scheduled or report-only CI surface (nightly mutation run, fullsuite, report-only attestation — anything whose trigger is `schedule:` rather than a PR, and that never blocks a merge) that goes red MUST open or update **one idempotent tracking issue per surface**: body carries the surface name, the run id, and the first failure line; a second red on the same surface updates that same issue rather than opening a new one; the surface going green again closes or resolves it; a green run touches nothing. Copy the existing idempotent pattern already in use elsewhere in this estate (`helm-guide-freshness-schedule.yml`'s shape) rather than inventing a second one. This does **not** make the surface blocking — a scheduled surface stays non-blocking by design; it only makes a red one visible instead of silent.

⚠ **Implementation status (2026-08-30): this is doctrine only.** As of this writing `.github/workflows/mutation-full-scheduled.yml` files no issue on red by design — its own header states *"Actions tab IS the finding — no GitHub issue is filed"* — and is `continue-on-error: true` with a step that prints "Report-only: this workflow never blocks a merge or deploy." No scheduled workflow in this repo opens or updates a tracking issue on red today. This clause states the target behavior; a separate build row is owed to wire the mechanism.

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
- Deprecated pages are **hard-removed** (no 301 redirects). The `guides/` directory retains hubs, the two explicitly-kept utility/demo pages (`regression-replayer.html`, `mcp-agent-demo.html`), and — by deliberate design (amended 2026-08-30) — hand-built non-hub pages (evidence packs, scenario walkthroughs, benchmark issues, reference guides) that were never part of the composer/Scenario-Guide removal and remain sanctioned. The earlier "hubs + two pages only" wording no longer matched the directory; it is amended here rather than the pages being deleted.

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

*Recorded trade-offs moved to `CONTRACT-RATIONALE.md` §A3 (2026-08-18) — background, not build rules.*

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
`scripts/check-playground-hermetic.mjs` enforces that `mcp-playground.html` makes NO network calls except `https://mcp.ainumbers.co`. Modeled on `check-ledger-hermetic.mjs` (§A7.2). SI-6 has shipped the page — `mcp-playground.html` is tracked on `main` — so the gate polices *what* it calls, not whether it calls anything; a defensive no-op for a missing file remains in the script but is not the live path. Wired into `scripts/preflight.mjs` and CI, same as §A7.2.

### A8.3 · Registration, not duplication
`mcp-playground.html` is added to `scripts/check-site-egress.mjs`'s lawful-exception list (`ALLOWLIST_FILES`) alongside `ledger/`'s `ALLOWLIST_PATHS` entry — the broad site-wide static egress scan (§A4.7 enforcement note) excludes it because the narrower §A8.2 gate already covers it precisely. This is registration in the existing allowlist, not a second detection mechanism.

### A8.4 · CSP and worker CORS are separate concerns, not covered here
The per-page CSP `connect-src` for `mcp-playground.html` and any Worker-side CORS change needed for a browser origin are SI-6's own build concerns (`check-csp-consistency.mjs`; CONTRACT §A4 same-push rule if the Worker changes). This amendment governs the egress carve-out only.

---

## Amendment A9 — Reliance-hedge clause (August 2026)

*Measured baseline and scope notes moved to `CONTRACT-RATIONALE.md` §A9 (2026-08-18). This amendment fixes the gap going forward and does not retrofit already-shipped tools.*

### A9.1 · Any surface citing regulation MUST carry a reliance hedge
Any `tools/`, `guides/`, or `chaingraph/` page whose visible output cites a regulation, statute, standard, or published rule (i.e. populates `regulatory_frameworks` or `regulatory_citations`, §3.1) MUST carry reliance-hedge language equivalent in substance to the canonical `.edu-disclaimer` block already used by a subset of existing tools: not legal/investment/tax/compliance advice, a computed view of the cited source as of a stated date, and an instruction to verify against the current official text before relying on it. `disclosures/terms.html` is the estate-wide statement of this posture and MAY be linked from a page instead of restating the full text, but a page whose entire function is producing a regulation-citing result SHOULD carry the hedge inline, not only by link.

### A9.2 · The hedge travels with the artifact, not only the page
Every OCG §13 export profile embeds a `reliance_notice` string in its shared metadata block (`chaingraph/exporters/_meta.mjs::metaBlock`), so the hedge is present in the exported JSON metadata, the human-readable renderings (PDF, xlsx), and the `vc` profile's `ocg:metadata`, independent of whether the originating page also shows it. A new §13 export profile MUST consume `metaBlock()` (or otherwise embed `RELIANCE_NOTICE`) rather than hand-building its own metadata block. `reliance_notice` is descriptive metadata, excluded from the `execution_hash` preimage like the rest of the §13 metadata block — it does not affect determinism or hash-neutrality (§0.10-class reasoning, `feedback-hash-neutral-is-not-proof-neutral`).

### A9.3 · Not a coverage gate
This amendment does not create a live "% of tools carrying a hedge" gate, and none should be built from it (mirrors §12's non-goal in `CLAUSE-BINDING-BUILD-SPEC.md`). The 104/155 and 12 figures above are the measured baseline this clause responds to, not a target a gate checks against.

---

## 🧾 §15 Claim-coverage matrix — every normative claim carries an enforcement disposition

**The mirror of `board/RULINGS.md` 2026-08-22 ("no gate without a normative source"): there is no normative source without an enforcement disposition.** Before this section, CONTRACT.md made 44 claims about how this estate is built and said of none of them what enforces it, so a reader auditing enforcement by CTRL-F could not tell a gated rule from an ungated one. The 2026-08-23 doctrine-execution audit measured the consequence: 19 of 44 claims (43%) rested on authorship alone, and two were VIOLATED on `main` with nothing anywhere able to notice.

**`DISCIPLINE` and `UNTESTABLE` are honest values.** A rule no script can check is not a defect in this contract; claiming it is checked would be. **The defect this section forbids is a claim with NO disposition** — and, worse, a claim naming a gate that does not exist, which reads as enforcement and enforces nothing (the audit's F2 finding, "gate-name theater"). **This is explicitly NOT a coverage mandate:** nothing here asks a `DISCIPLINE` row to become a gated one, and a change that converts dispositions wholesale to raise a number has misread the section.

**Gate:** `check-contract-claim-coverage.mjs` (meta) asserts every row below has a non-empty `Gate` cell that resolves to a script on disk, to a known worker-repo gate, or to `DISCIPLINE` / `UNTESTABLE`. Ⓦ marks a gate verified in the worker repo's own CI. Verdicts are the audit's, measured at `main` on 2026-08-23.

| # | Claim | Gate | Verdict |
|---|---|---|---|
| 1 | §0 single self-contained HTML per tool, all CSS/JS inline | DISCIPLINE | HOLDS |
| 2 | §0 Google Fonts only (DM Serif Display, Sora, JetBrains Mono) | DISCIPLINE | HOLDS |
| 3 | §0 zero fetch/WebWorker/external calls after load | `check-site-egress.mjs` | HOLDS |
| 4 | §0 zero PII collected, stored or logged | UNTESTABLE | no PII scanner exists in the estate |
| 5 | §0 all client storage forbidden (sessionStorage, localStorage, cookies, IndexedDB) | DISCIPLINE | HOLDS (write-shaped scan: 0 files) |
| 6 | §0 relative internal links; absolute URLs reserved | `dead-link-check.mjs` | HOLDS, PARTIAL (covers rot, not absoluteness) |
| 7 | §0 CSP tag on every page, canonical profiles | `check-csp-consistency.mjs` | HOLDS (ratchet baseline; value-blind) |
| 8 | §1.1 no lang toggle in new builds | DISCIPLINE | HOLDS (newest 40 tool numbers: 0 carry it) |
| 9 | §1.1 grandfathered tools keep `TRANSLATIONS` | DISCIPLINE | STALE NOTE: doctrine says ~187, actual 262 tools + 32 guides |
| 10 | §1.2 mfst toggle present, exactly one per tool | `verify_repo.py` | HOLDS |
| 11 | §1.2 `.mcp-toggle`/`toggleMCP()` RETIRED, MUST NOT appear in new or existing tools | `check-retired-mcp-toggle.mjs` | was VIOLATED (7 live tools) at audit; tombstone gate landed since |
| 12 | §1.3 PII banner exact text | `verify_repo.py` | HOLDS, PARTIAL (enforces text-correctness, narrower than "all tools") |
| 13 | §1.4 hard copy rules (em-dash, double-hyphen, entity decode, build codes `Wave N \| W-A…W-G \| D0`, heading emphasis) | `check-copy-hallmarks.mjs` | HOLDS (1529-file baseline ratchet) |
| 14 | §1.4 prose rules (negation-boxes, audience statement, date-currency) | UNTESTABLE | judgement rules; nothing scans them |
| 15 | §1.4 inline SSOT copies byte-identical to kernels | `check-inline-ssot-sync.mjs` | HOLDS |
| 16 | §1.5 `generated_at` visibility and decision-state rendering | DISCIPLINE | UNENFORCED BY DESIGNATED GATE: `check-node-page-chrome.mjs` contains zero §1.5 assertions (audit F2) |
| 17 | §2.1/§2.3 root `suite-registry.json` exists and lists all tools | DISCIPLINE | STALE PHANTOM: the file has never existed in git history |
| 18 | §2.2 manifest schema, `verb_noun_context` unique | `check-manifest-schema.mjs`, Ⓦ`check-tool-names.mjs` | HOLDS |
| 19 | §2.4 AIN Bridge deep-link behaviour contract | UNTESTABLE | runtime-only; no static artifact |
| 20 | §2.5 chain steps and `composer_url` resolve | `check-chain-composer-urls.mjs`, Ⓦ`validate-chains.mjs` | HOLDS |
| 21 | §2.7 new live nodes ship a manifest with `output_schema` in the same PR | DISCIPLINE | VIOLATED (2): art-527, art-541. Rule declares itself gate-free by design |
| 22 | §3.2 export button in `.results-export-row`, validate-before-download | `verify_repo.py` | PARTIAL: Check 3 gates placement; DOM/state/toast details are not covered |
| 23 | §3.1 `{tool_id}_{YYYYMMDDHHMMSS}.policy.json` naming | UNTESTABLE | runtime artifact, not statically observable |
| 24 | §4 Tier 1 export mandatory for the policy/rule/risk class | DISCIPLINE | HOLDS on the named set; the general predicate is judgement |
| 25 | §4 exports use native Blob; libraries only if approved and bundled inline | DISCIPLINE | HOLDS (0 external lib loads) |
| 26 | §5.1 canonical ranges, RESERVED numbers never reused | `check-tool-number-unique.mjs` | HOLDS on uniqueness; range table stale (ends T476, estate runs to #665) |
| 27 | §5.4 `start.html` grid: families only, cap 12 cards | DISCIPLINE | VIOLATED AS WRITTEN: 29 recipe cards, 0 family-hub links; page redesigned, rule never amended |
| 28 | A3.1 "composer/workflow/scenario guide" nouns banned in shipped copy | `check-shipped-prose.mjs` | PARTIAL: 1003 node+chain descriptions covered; guide/tool page prose and slugs are not |
| 29 | A3.3 `guides/` retains only hubs plus two utility pages | DISCIPLINE | STALE WHITELIST: 35 non-hub hand-built pages sit outside it |
| 30 | A3.4 no catalog/node twins | UNTESTABLE | the coverage predicate is undefined |
| 31 | A3.7 every chain and node in sitemap, `llms.txt` and catalog | `regen-sitemap.mjs`, `gen-llms-full.mjs`, `check-catalog-parity.mjs` | HOLDS |
| 32 | §6.2 `check_tools.js` is "the BLOCKING first gate" | `check_tools.js` | WIRING FRAGILE: runs in preflight, appears in ZERO workflow files; reached in CI only via `scripts-verify.yml`'s path-scoped preflight. Declared in `check-workflow-gate-parity.mjs`'s `PREFLIGHT_ONLY` |
| 33 | §6.2 SSOT conformance gates run before touching `standard/` | `schema-validate.mjs`, `spec-version-consistency.mjs`, `spec-gate-coverage.mjs` | HOLDS |
| 34 | §6.3 JSON-LD block on hub pages | `check-jsonld.mjs` | PARTIAL: preflight-only, no workflow invokes it. Declared in `PREFLIGHT_ONLY` |
| 35 | A4.0 shards not the monolith, plus assembly freshness | `assemble-chaingraph.mjs` | HOLDS |
| 36 | A4.2 re-vendor and commit generated worker inputs in the same push | `check-cross-surface.mjs` | HOLDS (634/634 byte-identical at audit) |
| 37 | A4.3 canonical `execution_hash` via the one shared module | `lint-forbidden-hash.mjs`, `golden-parity.test.mjs`, `parity-art-01.test.mjs` | HOLDS |
| 38 | A4.4 deploys solely via gated GitHub Actions; `NAMED_CHAINS` generated | DISCIPLINE | HOLDS WITH RESIDUE: `wrangler deploy` in exactly one workflow; a retired `NAMED_CHAINS` const survives beside the generated projection |
| 39 | A4.6 the kernel registry is codegen, never hand-edited | `gen-index.mjs` | HOLDS |
| 40 | A4.7 worker egress is a named closed allowlist; browser zero-egress | `check-site-egress.mjs` | HOLDS |
| 41 | A5.1/A5.4 SPEC wins; every SPEC MUST has a §15 gate | `spec-gate-coverage.mjs` | FORMALLY HOLDS: the meta-gate is green inside the matrix's visibility, and ≥603 MUSTs sit outside it (audit F5) |
| 42 | A7/A8 ledger and playground hermetic carve-outs | `check-ledger-hermetic.mjs`, `check-playground-hermetic.mjs` | HOLDS |
| 43 | A9 the reliance hedge travels with the artifact | DISCIPLINE | HOLDS BY STAGING: no coverage gate, by A9.3's explicit ruling |
| 44 | `repo/CLAUDE.md`: author via Write/Edit not heredoc, preflight before every push, hook opt-in | DISCIPLINE | process rules; the hook exists, and its CI backstop is row 32's fragile path |

---

**END OF CONTRACT**  
*This document is version-controlled. All deviations require a formal spec amendment and consensus from Post Oak Labs Engineering & Compliance leads.*