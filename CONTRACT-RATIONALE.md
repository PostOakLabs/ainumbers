# 📜 AINumbers.co — Build Contract RATIONALE (§0–§6, amendments, CLAUDE.md notes)

> **This file is the WHY half of `CONTRACT.md`** (§0–§6, plus amendment trade-offs and the non-normative notes from `CLAUDE.md`). `CONTRACT.md` carries the normative rules (MUST / NEVER / exact text, ids and schemas); the explanatory prose, precedent notes and audit history that used to sit beside them live here, **verbatim**, under the same section numbers. Split out on 2026-08-18: nothing was summarized, reworded, or dropped, and no rule changed meaning.
>
> **Reading order:** `CONTRACT.md` §0–§6 is the required read for a build. This file is optional background, useful when you need to know why a rule is worded the way it is before proposing a change to it.

### §1.1 — Multilingual Toggle — DEFERRED (Option A)

When bandwidth allows, a proper implementation (translated metadata layer for ES/FR/PT with AR/中文 stubs) is fully specced in **`../I18N-SPEC.md`** (Option B). That spec is the source of truth for any future re-implementation.
This is a held state — the toggles were cosmetic and do no harm.

### §1.2 — Mandatory UI Components

Pattern unified with sister suite Apex Logics; swept via `standardize_mcp_toggle.py`.

### §1.4 — Reader-Facing Copy Style (Amendment A6)

Typing ` -- ` where an em-dash was removed is itself a machine-generated tell: it reads as a CLI flag or as un-typeset draft text, and it is banned for the same reason the em-dash is.
**Measured debt at the time the two 2026-08-02 rules were written** (prose-visible only, using the gate's own strip logic — `<script>`/`<style>`/`<pre>`/`<code>`/comments/badges removed): ` -- ` in **453 hits across 204 files**; entity-encoded em-dashes in **2 211 hits across 686 files**. Both are legacy debt and both get a baseline bucket on introduction, on the same ratchet as the em-dash count (a baselined file may carry at most its recorded count; any file absent from the baseline must be clean). The entity figure is the more serious finding: those em-dashes were never counted by any gate, so they are debt the suite did not know it had, not debt it chose to defer.

### §1.5 — Node-Page Result Provenance

**The failure this section exists to prevent** is a page that computes a value, exports it in the artifact, and never shows it to the person reading the screen. The reader then cannot answer questions the artifact can already answer. The measured basis for each rule is stated inline below, so the rule and its evidence stay together.

### §1.5.1 — `generated_at` MUST be visible

  - *Why this clause is here rather than assumed.* Every node page today mints `generated_at` inside `exportArtifact()`, so the field records when the reader clicked export, not when the numbers were computed. `art-525-nway-balance-closure-check.html` is the one page that renders the value, and it calls `new Date()` twice independently (`:629` for display, `:688` for export), so its two timestamps are from two different moments. Rendering without this clause would propagate that divergence across the estate.
  - *Scope of the change this implies.* Moving the capture point changes the artifact's `generated_at` **value** for a run exported later than it was computed. It changes no field, no type, no schema outcome, and no hash: `execution_hash` is taken over `{policy_parameters, output_payload}` only (`chaingraph/kernels/_hash.mjs`), and `scripts/check-page-determinism.mjs` explicitly holds that a clock value reaching the envelope or the DOM is outside the preimage and is not a determinism defect.

### §1.5.2 — A rendered decision MUST show every state it can reach

Collapsing `did_not_run` into "fail", or a review state into "pass", tells the reader something untrue.
A two-state computation renders correctly under this rule with two affordances; nothing here obliges a third.
Several distinct shapes are live across the estate, and the pointer's shape is hash-bearing: it sits inside `output_payload`, so re-shaping it moves `execution_hash` and stales the node's proof. This section therefore takes each page's shape as given.
**§1.5.2 is a standing rule, not a sweep.** The survey behind this section examined 526 kernels and found 50 fields carrying three or more states; every page flagged as omitting one was read by hand, and **none was a presentation discard**. The two cases that looked closest (`art-44` / `art-46`, and `art-174`'s `coverage_band` against the page's `overall_coverage`) are page-versus-kernel divergence, which belongs to the divergence programme.

### §2.5 — MCP Workflow-Chain Integrity (Amendment A1.5)

This check exists because Wave-2 chains once referenced invented slugs (e.g. `53-stablecoin-compliance-checker` vs the real `53-cbdc-architecture-comparator`), silently 404ing on the live server.

### §2.7 — §2.2 reaches ChainGraph nodes

This settles a scope question §2.2 left open by titling itself "Per-**Tool**"; it introduces no new field and no new artifact class (8 node-only `art-*` manifests already exist).
Whether to normalise is a separate open question.
A gate is the right eventual mechanism, but only once the backfill below is closed — a gate that is red on the day it lands enforces nothing.
**A schema that has drifted from the emission is worse than none** — it is a false claim an agent will act on.
- **Existing nodes (open debt, owned elsewhere):** measured 2026-08-02 across 526 live nodes with an `mcp_name`, **21 have a manifest file and 6 declare an `output_schema`** — so **505 nodes have no manifest and 520 declare no output shape.** That is a large, explicitly acknowledged conformance debt, tracked and closed separately: it does **not** block any push today, and it does not make those nodes retroactively invalid. **Do not restate those figures as current** — re-derive them by `tool_id` against `chaingraph.json` before quoting.

### §3.1 — AINumbers Policy Mandate v1.0 Schema (not AP2)

Real AP2 (see [ap2-protocol.org](https://ap2-protocol.org/)) defines IntentMandate / CartMandate / PaymentMandate for agent-mediated payment flows — a different problem domain.
Adopted for human-readable audit + machine-agent ingestion. `execution_hash` added as optional audit metadata.

### §4 — Export Tier System

Prevents client-side bloat & enforces deterministic guarantees.

### §5.3 — Orchestrated Workflow Runner pages

An earlier duplicate file state was resolved; both are live and valid.

### §6.2 — Pre-Merge Validation Pipeline

(Added 2026-06-11 after a structural JS edit silently deleted live code in dozens of tools — syntax errors are invisible until a user hits them.)

### §A3 — Recorded trade-offs (ChainGraph orchestration surface)

- Inbound external links to removed guide URLs break (accepted — A3.3). The MCP `composer_url` fields are repointed to chain pages.
- Two export schemas coexist transitionally: §4 (ChainGraph) and §3.1 Policy Mandate (un-promoted catalog tools). The crosswalk (A3.5) keeps them reconcilable; the long-term direction is §4 only.
- The catalog tool count **drops** as tools are promoted/retired — update the "counts drift" verification and any hardcoded totals.
- This amendment supersedes the optional-`execution_hash` language in §3.1 for ChainGraph artifacts, deprecates architecture #4 in §5.3, and updates the §1.2 disclosure rules to the `/chaingraph/` surface.

### §A9 — Reliance-hedge clause · measured baseline

Measured baseline that motivated this clause: 104 of 155 tools citing a regulation carried no reliance hedge of any kind, only 12 carried a `class="disclaimer*"` div, no estate-wide terms page existed, and this document contained the word "advice" zero times. This amendment fixes the gap going forward; it does not retrofit the 104 already-shipped tools — that retrofit is a separate, larger, future work unit and is explicitly out of scope here.

### repo/CLAUDE.md notes — non-normative build guidance

- **`<link rel="canonical">`** uses absolute URLs intentionally — this is correct SEO practice, not a routing violation.
- **index.html is 5 500+ lines** — high truncation risk in any AI context window. Edit surgically with grep + line numbers rather than reading the whole file.
