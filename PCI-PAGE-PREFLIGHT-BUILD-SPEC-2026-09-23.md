# PCI-PAGE-PREFLIGHT-BUILD-SPEC — payment-page script authorization & tamper-evidence preflight (PROPOSAL for Tim ruling, 2026-09-23)

> **Status: PROPOSAL — no board rows minted** (SO #30: the ORCH mints on ruling; proposed row `PCI-PAGE-PREFLIGHT-1`, §T). **Parent research:** `WORKFLOW-GAP-AND-BORROW-REPORT-2026-09-23.md` §3 Priority A — the only candidate that passed all three no-duplicate tests with a *final* (non-consultation) authority; ranked #1 in the 2026-09-23 risk/reward triage. **Adversarial pass 2026-09-23: PA-1..PA-13 all ACCEPTED and folded (authority-fidelity seat)** — see `PCI-PAGE-PREFLIGHT-ADVERSARIAL-REVIEW-2026-09-23.md`; folded fixes tagged `[PA-n]` inline.
>
> **Authority:** `repo/CONTRACT.md` §0 (single self-contained `.html` per tool; deterministic execution; zero network I/O after load; zero PII), §1.5 (`generated_at` visible; every reachable state rendered), §2 (machine-readable registry & MCP contract). Node/manifest/kernel/registry surfaces are generator-owned; `repo/CLAUDE.md` governs builds inside `repo/`.
>
> **Pinned authorities (all final — no consultation-stage text):**
>
> | Pin | Value | Where held |
> |---|---|---|
> | PCI DSS v4.0.1 (June 2024) — normative text of 6.4.3 / 11.6.1 | `sha256 5e6b9093b84007b973097d20126a3768ea2f0a1d4200255c849b0fb3bf04ebc7` | `research/clause-snapshots/PCIDSS-v4_0_1-full.pdf` (+ `pcidss-v401-full.txt`; 6.4.3 ≈ line 5056, 11.6.1 ≈ line 9402) |
> | PCI SSC information supplement "Payment Page Security and Preventing E-Skimming – Guidance for PCI DSS Requirements 6.4.3 and 11.6.1" | announced 2025-03-10; Document Library lists Apr 2025; 8 language editions | Download is JS-gated — **builder MUST capture the PDF + sha256 into `research/clause-snapshots/` before kernel work starts** (open pin, §K) |
> | Enforcement state | 6.4.3 / 11.6.1 mandatory (no longer best-practice) since **2025-03-31**; v4.0.1 is the current standard version | blog + Document Library (verified 2026-09-23) |
>
> **Provenance (SO #48):** estate citations verified against local checkout `repo/` branch `guide-hypermap @ 8789cb5a` on 2026-09-23 (spec author + independent adversarial seat). Builder MUST re-quote the freshness triple against origin refs at claim time.
>
> **Prove shape (SO #62): kernel bytes DO change** — new tool page + node + manifest + kernel + one `card-programme` chain edit. After touching `chaingraph.json`/manifests/kernels in `repo/`, run `generate.mjs` in `mcp-apps-poc/` and commit both repos in the same push (workspace CLAUDE.md cross-repo rule).

## §P Premises (SO #44) — each with its evidence

- **P1 — The measured gap is ingest-and-compare, and it is empty today.** `repo/tools/226-pci-dss-v4-scope-wizard.html` explains 6.4.3/11.6.1 (7 refs) as scoping questionnaire + prose; `188-merchant-bnpl-compliance-mapper.html` emits a checklist; `card-programme` stage 3 is scope-only. No estate surface ingests script manifests, authorization records, integrity digests, received-header baselines, or change events. Verified by two independent passes 2026-09-23 (report scan + adversarial seat).
- **P2 — The evidence unit is browser-received, not server-config.** 11.6.1's operative text requires detection of unauthorized modification (including indicators of compromise, changes, additions, deletions) to security-impacting HTTP headers **and script contents of payment pages "as received by the consumer browser"**; the mechanism evaluates the *received* headers and pages. Supplement rationale: CMS/tag-manager assembly means server-side change detection can miss browser-perceived change. Consequence: the node ingests **user-supplied received-page captures**, and per §0 it can never fetch pages itself.
- **P3 — 6.4.3 is three deterministic checks over an inventory.** (i) a method to confirm each script is authorized; (ii) a method to assure each script's integrity; (iii) an inventory of all payment-page scripts with **written business/technical justification** for why each is necessary. Customized-approach objective: unauthorized code cannot execute in the payment page. Testing (6.4.3.a–c) examines policies, inventory records **and system configurations** — so the evidence set must cover process records, not only the manifest.
- **P4 — Cadence has two conformant legs.** 11.6.1 requires the mechanism to run **at least weekly OR at the frequency defined by a targeted risk analysis per Req 12.3.1**. The kernel MUST treat both legs as first-class and report which leg the evidence claims; hard-coding weekly as the only legal value is a spec violation.
- **P5 — Scope posture changed under the estate's prose.** SAQ A no longer carries 6.4.3/11.6.1 (replaced by an eligibility statement); the preflight's honest audience is SAQ A-EP / SAQ Merchant-Any / custom-approach and tailored assessments. Secondary-source flag: page copy may not hard-code SAQ mapping; builder pins the current SSC SAQ A document at build time (`[PA-3]`).

## §D Deterministic pipeline — kernel stages (v1)

| Stage | Operation | Determinism notes |
|---|---|---|
| S1 intake & sanitize | Validate manifest / baselines / change-events against `input_schema`; reject (not strip) records carrying PAN-like, SAD-like, or authentication-value patterns. Pinned pattern classes `[PA-3]`: 13–19 consecutive digits (separators optional) that are **Luhn-valid**, applied to **every field regardless of field name** (a digest can carry long digit runs; a free-text justification can carry a PAN — field-name exemptions open the leak path), plus explicit SAD/auth-value classes (CVV, PIN, auth request/response values) | Reject-not-strip so no sanitized residue enters artifacts; pattern classes live in the kernel as a pinned constant table; `verify_repo.py` PII text gate stays green |
| S2 script completeness (6.4.3 iii) | Per script: require `source_url`, `origin` (first/third-party), `written_justification`, `authorization_ref` (owner + record), `integrity_method` ∈ {`sri`,`hash`,`signed`}, `digest`, `version` | Missing field → classification, never a guess; order of output = input manifest order |
| S3 integrity evaluation (6.4.3 ii) | Compare each declared `digest` against the digest observed for that script in the supplied received-page baselines; record `declared==observed` boolean + method. Selection rule `[PA-4]`: compare against the **latest baseline by supplied baseline timestamp**; the same `source_url` appearing within one baseline with differing observed digests → `unresolved_inputs`, never a silent pick | Pure string/hash comparison of user-supplied values; the tool never fetches scripts |
| S4 authorization delta (6.4.3 i) | Diff declared allowlist ↔ manifest ↔ baseline script set; classify each script `unauthorized_added` / `removed_still_referenced` / `digest_changed` / `unchanged` / `classified_authorized` | Sorted-by-source_url merge; tie-break by digest to keep output stable |
| S5 header evaluation (11.6.1, headers) | Over received-header baselines: CSP presence, script-src constraint presence (declarative string checks — NOT a CSP evaluator, §W), and a baseline-to-baseline diff of the security-impacting header set. The diffed set is a pinned `SECURITY_HEADERS` constant `[PA-1]` — the standard names the class but enumerates no list, so v1 MAY NOT diff headers beyond the pinned list; list + provenance note are a build prerequisite (§K) | Header names lower-cased, sorted; values compared byte-wise |
| S6 mechanism evidence (11.6.1, cadence) | Every classified modification must map to an alert/change record; interval check reports `weekly_leg` (consecutive mechanism-run timestamps ≤7×24h apart, inclusive, normalized to **UTC**) or `tra_leg` (TRA reference present) — P4 `[PA-6]` | Interval arithmetic on the supplied timestamps only; no wall-clock reads |
| S7 verdict bands | Evidence-set status ∈ {`complete`, `gaps_found`, `unresolved_inputs`}, precedence `unresolved_inputs` > `gaps_found` > `complete` `[PA-7]` + per-script/per-header classifications; page renders every reachable state (§1.5.2) | **Never** a compliance/QSA verdict — fixed label on every surface: "evidence preflight; the Standard and assessor validation govern" |
| S8 artifact | Deterministic JSON evidence artifact + exception dossier; `execution_hash` per CONTRACT; `generated_at` visible (§1.5.1) | Canonical serialization: sorted keys, no floats (integers + strings only) |

## §C Integration

- **New node:** `tool_id = <next-allocated-page>-pci-payment-page-script-preflight` (next page number per **`repo/CONTRACT.md` §5.1** allocation — never reset, never reuse RESERVED; do not reuse 226/188) `[PA-13]`; the node record is authored as **shard + `chaingraph.meta.json` order.nodes append only** — CONTRACT A4.0 forbids PRs reassembling `chaingraph.json` (main-side bot assembles; `--enroll` covers a forgotten append) `[PA2-4]`, superseding PA-11's both-targets wording; the shard carries **all 14 schema-required fields**, and `standards_basis` takes the §30 enum (`implements_standard`) with `cited_clause_digest[]` pinned via `pin-clause-snapshot.mjs` into the repo's `clause-snapshot-registry.json` — workspace `research/clause-snapshots/` pins alone do not satisfy CLAUSE-DIGEST-GATE-1 `[PA2-2]`; `mcp_name = preflight_payment_page_scripts`, `mandate_type = compliance_mandate`, `gpu: false`, `deadline_note: "enforceable since 2025-03-31"`.
- **Chain:** extend `card-programme` — insert stage between `226-pci-dss-v4-scope-wizard` and `228-3ds-emv-compliance-checker`. **Honesty correction `[PA2-8]`:** chain handoffs in this estate are navigational prose + composer prefill URLs (prompt sequencing via `mcp_bindings.build_chaingraph`), NOT machine dataflow — none of card-programme's steps has a kernel (helm pack steps carry `kernel_digest: sha256:000…000, verified: false`), so nothing consumes this stage's output programmatically. New handoffs are written in **sequence-only register** — causation verbs ("feed") red `check-chain-handoff-register.mjs`, whose baseline may never rise `[PA2-5]` — e.g. "then check 3DS/EMV compliance". The steps edit is a **REFUSED-class assembly diff**: it lands only via attended `assemble-chaingraph.mjs --land-structural=<ROW>` on main, followed by a **second** worker re-vendor (the monolith the worker reads stays old until the land) `[PA2-1/PA2-7]`. Collateral strings `[PA-10]`: 226's handoff, the following step's handoff, the chain `description`, 226's `feeds` edge; the handoff-register baseline is unchanged (sequence-only keeps the causation count at 4). The generic DPP chain and all other chains are untouched.
- **Projection:** MCP / WebMCP / Helm only through the existing generators, after the input schema survives its first fixture wave (report §3 guardrail).

## §F Conformance fixtures (golden set, all synthetic)

1. Complete authorized page set → `complete`, zero exceptions. 2. Manifest entry missing `written_justification` → classified gap. 3. Baseline script absent from allowlist → `unauthorized_added`. 4. Digest change with no alert record → S6 gap. 5. Digest change with in-range alert → pass. 6. TRA-leg cadence (29-day interval + TRA ref) → pass on `tra_leg`. 7. Header drift (CSP removed between baselines) → S5 exception. 8. PAN-like string at intake → S1 rejection artifact. 9. `removed_still_referenced` classification (manifest entry with no baseline presence) `[PA-8]`. 10. Schema-invalid input → `unresolved_inputs` band wins precedence `[PA-7/PA-8]`. 11. Header **addition** between baselines → S5 exception (11.6.1 covers changes, additions, and deletions) `[PA-8]`. 12. Declared ≠ observed digest → S3 path distinct from S4 `digest_changed` `[PA-8]`. 13. Luhn-valid PAN inside a free-text `justification` field → S1 rejection (field-name-independent patterns) `[PA-3]`. Plus determinism: identical inputs → byte-identical artifact **modulo `generated_at`** (§1.5.1 mandates a real timestamp; alternatively the fixture injects it), run twice `[PA-2]`.

## §X Explicitly out of scope (v1)

No network I/O of any kind (no crawling, no SRI fetches — §0) · no PAN/SAD/authentication data ever, even in fixtures · no full CSP directive parser/evaluator · no SAQ selector or scoping wizard (that is 226's job) · no compliance, QSA, or acquirer-validation claim · no storage of user captures beyond session · no second PCI scoping surface.

## §W Parked (dated observations)

- **CSP directive-level evaluation** (v1 is presence/constraint-string checks) — revisit after first fixture wave. (2026-09-23)
- **In-tool capture helper** (browser extension / bookmarklet producing baseline JSON) — separate ruling; §0 unaffected either way. (2026-09-23)
- **SAQ-mapping module** — on pinning the current SAQ A document (P5). (2026-09-23)
- **Supplement re-version watch** — on any SSC revision, re-pin PDF + sha256 and re-derive S2 attribute set. (2026-09-23)

## §J Rejected alternatives (so the ORCH does not re-litigate)

- **Second scoping wizard:** rejected — report guardrail forbids duplicating 226; this node is ingest-and-compare, a different operation.
- **Server-side page-scanning service:** rejected — breaks §0 zero-egress posture and the estate's "evidence before action" pattern; the worker hosts no crawler.
- **AI/LLM classification of script purpose:** rejected — non-deterministic; justification quality is a human attestation recorded verbatim, not scored by the kernel.

## §K Risks & mitigations

| Risk | Mitigation |
|---|---|
| Supplement PDF not pinned before build drifts into paraphrase | Hard gate: S2 attribute set MAY NOT be coded until the PDF + sha256 sit in `research/clause-snapshots/` (§K open pin) |
| "Security-impacting HTTP headers" is a class, not a list — S5 nondeterministic without one `[PA-1]` | Same hard-gate shape: S5 MAY NOT be coded until a pinned `SECURITY_HEADERS` list + provenance note sits in the kernel/spec |
| Stale neighbor copy: `226-pci-dss-v4-scope-wizard.html` still tells readers SAQ A owes 6.4.3/11.6.1 (P5 changed this) `[PA-12]` | Outside this row's fence — recorded as a separate copy-fix candidate so the contradiction is visible, not silently inherited |
| User pastes a real capture containing PANs | S1 reject-not-strip + intake rejection artifact + PII banner; `verify_repo.py` green |
| Tool read as a compliance certification | Fixed disclaimer on page + artifact (S7); fixtures assert the label's presence |
| Cadence misread as weekly-only (P4) | S6 reports both legs; fixture 6 locks the TRA leg |
| Authority drift (standard/supplement revisions) | Version-pinned hashes; re-derivation trigger in §W |
| Garbage-in manifests | S1 schema gate + `unresolved_inputs` band instead of silent scoring |

## §T Staging — UNMINTED

Proposed single row `PCI-PAGE-PREFLIGHT-1` (repo: site; fence: §D + §C + §F; gates: site-repo `check-site-egress.mjs`, `check-copy-hallmarks.mjs`, `check-tool-number-unique.mjs`, the `check-chain-*` family + handoff register, generated-artifact ownership, `verify_repo.py` `[PA-9]`; worker-side `check-tool-names.mjs`/`validate-chains.mjs` ride the `mcp-apps-poc generate.mjs` same-push). Awaiting ruling; ORCH mints per SO #30.

## §R2 Pass-2 amendments (estate-value + breakage seats, 2026-09-23) — all ACCEPTED and folded

> Findings + dispositions: `PCI-PAGE-PREFLIGHT-ADVERSARIAL-REVIEW-2026-09-23.md` §Pass 2. Inline `[PA2-n]` corrections sit in §C; the rest fold here.

- **`[PA2-9]` Input producer — GATING RULING.** No estate mechanism produces the S3/S5 input bundle (received-page header baselines, browser-received digests, change events); estate input idioms top out far below it (226's `input_schema` is 5 scalars; the heaviest array precedent is 3 props). Kernel work is hard-gated on this ruling exactly as on the supplement-PDF pin. Ruling options: (i) rule the §W capture helper INTO this row's fence; or (ii) shrink v1 to inputs users verifiably hold — S1/S2/S4 (declared manifest vs allowlist) — demoting S3/S5/S6 to v2. **SWORN guard `[SW-1]`:** option (i) is admissible only network-denied — page-context bookmarklet or an extension over local browser APIs; an API-backed capture service is not an option (see §SWORN).
- **`[PA2-3]` §18 compute proof.** gpu:false live node ⇒ well-formed `compute_proof` OR `compute_proof_ready:"deferred"` + non-placeholder reason + in-PR `scripts/compute-proof-baseline.json` bump (legal for a brand-new node; art-687/689 precedent).
- **`[PA2-12]` Landing cost.** Post-merge deferred-baseline bump assigned to the Lander per `NEWNODE-DEFER-PIN-DOCTRINE-1` (the class reddened main 3× in one day when skipped).
- **`[PA2-6]` Gate-list extension.** Adds `check-csp-consistency.mjs`, `check-node-complete.mjs`, `check-gpu-flag-parity.mjs`, kernel-index codegen (`gen-index.mjs --write`), `hub-categories.json`, `check-node-page-chrome.mjs` (canonical header/footer — corpus-wide per the STP riders), the §16 proof surface, and the **Policy Mandate export contract** (mandatory for compliance-class tools).
- **`[PA2-7]` Staging rule.** Worker re-vendor runs from a fresh post-bot-commit `origin/main` checkout — never the PR branch, whose committed monolith silently omits the new node from the vendor.
- **`[PA2-10]` Usage null-hypothesis (§K row added).** Estate telemetry: ~1,384 real `tools/call`s over five days; ≤0.3%-per-tool long tail; no compliance preflight in the top 15. "Measured gap" is not "measured demand" — adoption is a hypothesis the row states, not assumes.
- **`[PA2-11]` Sequencing.** The row does not displace the never-staged spec backlog (5 fully-authored specs, CORE-VERIFY the largest block) or the repair-only queue (`board/QUEUE-INDEX.md`: 26 queued rows, all infrastructure); it queues behind them absent an explicit prioritization ruling.
- **`[PA2-13]` Discoverability.** Recorded: the tool becomes the 591st card in `llms-full.txt`; its discovery surface is the card-payment hub placement; `check-catalog-parity.mjs` already tracks 17 pre-existing orphan chain pages.

## §STP posture (2026-09-23 — assessed against `STP-WAVE-COMPLIANCE-RIDERS.md` + `STP-BRANCHABILITY-BUILD-SPEC.md` rev 2)

**Classification ships; decision does not.** The S7 band is a machine-readable classification, never an auto-decision: authority to proceed, remediate, or accept lives in a caller's signed §22 Work Mandate, not in this node (SWORN test 3; §X). Auto-decisioning can therefore only ever enter this row from outside — a caller wrapping it in a mandate-gated execution — and the node needs no change to permit that.

- **Gate-authorable output `[STP-1]`.** The branchability spec's measured pain is ~20 bespoke status vocabularies across 523 kernels, forcing every gate author to learn each node's output shape before writing a §21.4 gate pointer. The S8 `output_payload` therefore exposes its verdict at ONE stable, documented pointer — aligned with the predictable-decision-pointer work (`research/stp-decision-pointer-draft-2026-09-22.md`) when it lands; until then the pointer is recorded in the manifest, so the node is gate-authorable without bespoke knowledge.
- **No §21.4 gates in v1.** card-programme is navigational (no step kernels), so gating it would demand execution machinery, both-branch fixtures, and composite-hash structure that are out of scope. If that chain ever becomes executable, the three bands are the intended gate inputs (`complete` → proceed; `gaps_found`/`unresolved_inputs` → end).
- **Riders adopted even though this is not an STP-wave build:** per-kernel conformance fixtures (already §F) and canonical node-page chrome (`check-node-page-chrome.mjs` — corpus-wide, added to the §R2 gate list). **Decision-receipt export parked:** riders item 5 (§13.11 W3C-VC-2.0 / §16 signature) binds only when a row emits a compliance decision — v1 deliberately does not; wiring it rides the same future ruling as any decision-bearing use.

## §SWORN conformance (2026-09-23 — audited against the five-test filter in `FINTECH-SAAS-SWORN-BORROW-SCAN-2026-09-23.md`, grounded in SPEC.md §§16–27 + CONTRACT §0)

**No API anywhere.** Runtime: S1–S8 operate on user-supplied inputs only. Note S3 specifically — digests are compared between user-supplied declarations and user-supplied baseline captures, **never fetched from script origins** (a naive SRI implementation that re-hashes the live script would be a network call; this design does not do it). Build time: the supplement PDF is a human Document-Library download, not an API; the attended land and re-vendor steps are git/CI. Projection: MCP/Helm are the estate's own zero-egress kernel surfaces (browser/worker), not new external endpoints — this row adds no worker route.

| SWORN test | Verdict | Basis |
|---|---|---|
| 1 Offline continuity | PASS | Deterministic JSON artifact + `execution_hash`; verifiable with no site, worker, or network; no regulator service is referenced at runtime |
| 2 Customer control | PASS | Zero egress (§0), session-only, nothing stored or transmitted; the estate never sees a capture |
| 3 No authority capture | PASS | The node records and classifies evidence; it never declares a script authorized or a page compliant — authorization lives in the user's own records; the fixed non-verdict label is load-bearing |
| 4 Separate trust labels | **TIGHTENED `[SW-2]`** | Artifact schema partitions every field under exactly one label: `source_asserted` (declared manifest, allowlist, authorization refs), `kernel_computed` (digest comparisons, deltas, cadence arithmetic), `human_attested` (written justifications, dispositions of change events). No upgrade path between labels |
| 5 Bounded side effects | PASS | Evidence-only; no action, notification, or submission surface exists to bound |

`[SW-2]` is the one substantive design addition from this audit: the S8 artifact schema and page rendering MUST carry the three trust labels as distinct field classes, and fixtures must include one field of each class so the separation is tested.

## Sources

[PCI SSC blog announcement (2025-03-10)](https://blog.pcisecuritystandards.org/new-information-supplement-payment-page-security-and-preventing-e-skimming) · [PCI SSC Document Library](https://www.pcisecuritystandards.org/document_library/) · [EC (n/a) — no external dependencies beyond the two SSC documents] · local pins per header table.
