# BATTERY-PASSPORT-READINESS-BUILD-SPEC — 71-data-point readiness & supplier-evidence preflight (PROPOSAL for Tim ruling, 2026-09-23)

> **Status: PROPOSAL — no board rows minted** (SO #30; proposed row `BATTERY-PASSPORT-READINESS-1`, §T). **Parent research:** `WORKFLOW-GAP-AND-BORROW-REPORT-2026-09-23.md` §3 Priority B (battery); ranked #2 in the 2026-09-23 risk/reward triage on the strength of a hard statutory clock. **Adversarial pass 2026-09-23: BT-1..BT-9 all ACCEPTED and folded (authority-fidelity seat)** — see `BATTERY-PASSPORT-READINESS-ADVERSARIAL-REVIEW-2026-09-23.md`; folded fixes tagged `[BT-n]` inline.
>
> **Authority:** `repo/CONTRACT.md` §0 (single self-contained `.html`; deterministic; zero network I/O; zero PII), §1.5 (result provenance, all-states rendering), §2 (registry & MCP contract). `repo/CLAUDE.md` governs builds inside `repo/`.
>
> **Pinned authorities:**
>
> | Pin | Value | Where held |
> |---|---|---|
> | EC Guidance Document "Digital Batteries Passport – data points by category", **Version 2.0 – 15 August 2026**, Ref. Ares(2026)7968937 – 19/08/2026, 2nd edition, **CC BY 4.0** | `sha256 e045a7668015520f4c353e72fb57a89bdd62baaf0a98e6f4aefc7f5f42819eb7` | `research/clause-snapshots/EU-BR2023-1542-BatteryPassport-datapoints-guidance-v2.0-20260815.pdf` (15 pp; all 71 data points × EV / LMT / industrial applicability × legal source) |
> | Regulation (EU) 2023/1542 — **consolidated version 02023R1542-20250731** (the version the guidance's own footnote 1 pins) | EUR-Lex CELEX 02023R1542-20250731 | External pin; builder records access date |
> | Data carrier | Battery passport accessible via QR code per Art 77(3); QR per ISO/IEC 18004:2015 (Recital 44); disability-accessible per Directive (EU) 2019/882 | External pin |
> | Ontology alignment (for the art-115 handoff) | CIRPASS-2 EU DPP Core Ontology + CIRPASS-2 Battery Ontology (DPP Vocabulary Hub / Semantic Treehouse); GS1 Digital Link identifier pattern | Already art-115's validated surface — this node aligns to it, does not re-validate it |
> | **License condition** | CC BY 4.0: the embedded matrix MUST carry attribution + change-indication in the data file and page footer | Enforced by fixture F8 |
>
> **Provenance (SO #48):** estate citations verified against local `repo/` `guide-hypermap @ 8789cb5a` (2026-09-23, spec author + independent adversarial seat); matrix facts transcribed from the pinned PDF, whose derived counts were re-derived independently twice and agree (P6). Builder MUST re-quote freshness triple at claim time.
>
> **Prove shape (SO #62): kernel bytes DO change** — new tool page + node + manifest + kernel + **matrix data file** + one new chain. `mcp-apps-poc generate.mjs` same-push rule applies.

## §P Premises (SO #44)

- **P1 — The measured gap is battery-specific applicability, and the estate has zero battery content.** `digital-product-passport-lineage` (art-115 → art-116 → art-117) validates a generic CIRPASS-2 carrier, lineage, and authenticity; the only "battery" hits in `chaingraph.json`/tools are test-battery false positives (art-434, art-489). Verified by two independent passes 2026-09-23.
- **P2 — The authority is published, versioned, hash-pinned locally, and licensed for embedding — and self-describes as non-authoritative.** Guidance v2.0 states it "should not be considered as representative of the European Commission's official position", is "not authoritative", "does not extend in any way the rights and obligations deriving from applicable legislation", and "may be further developed over time" (formats/units flagged as possible future additions). Consequence: every artifact is labeled a **guidance-version diagnostic**; the Commission's disclaimer is quoted on the page.
- **P3 — The matrix is fully enumerable.** 71 numbered data points; columns: number, name, legal source (BR article/annex, e.g. Annex VI A(1)–(10), Annex XIII 1(b)–4(d), Art 77(3), 13(4)/(5), 14, 18, 48(1), 74(1)), and one applicability cell per category (EV / LMT / industrial >2 kWh). Footnote 2 defines "if applicable" = take into account applicable provisions + whether the technical parameter is relevant for that battery.
- **P4 — The clock is hard: passports mandatory 2027-02-18** for EV, LMT, and industrial >2 kWh batteries — ~5 months from spec date. `deadline: 2027-02-18` on the node, with `deadline_note` carrying the category/capacity condition.
- **P5 — The deferral ledger is exact, not vague.** Points **17–18** (carbon-footprint declaration + label): not to be filled/displayed as of Feb 2027 — format still to be specified in the upcoming implementing act. Point **19** (due-diligence report info): required from **August 2027** per Art 48(1). Points **20–23** (recycled-content shares Co/Li/Ni/Pb): to be applied in line with Article 8 and the relevant delegated act. Point **44** (instructions for use): application provisions **on hold pending Omnibus adoption**. The kernel encodes these as per-point statuses derived from the matrix — never as prose assumptions.
- **P6 — Derived counts are computed, never hard-coded, under a stated counting rule.** Counting rule `[BT-1]`: a point counts as **mandatory at Feb 2027** for a category iff its matrix cell reads exactly **Mandatory**, plus point 51 for EV/LMT (cells read "same as data point 11 (capacity), but now dynamic"); every other cell wording (*if applicable*, *optional*, *only applicable for some*, *not to be filled/displayed*) is excluded. Totals: **EV 47 / LMT 50 / industrial 32** — without the pt-51 convention the totals are 46/49/32, so the convention is load-bearing. Re-derived twice from the pinned matrix (spec author + adversarial seat) and cross-checked against an independent third-party tracker (cross-check only, never source; §J). Fixture F1 locks these three numbers as *expectations over the matrix*, and the kernel recomputes them at runtime under the stated rule.
- **P7 — Downstream ecosystem is partially pending.** The battery-passport registry implementing act (Commission/EEA-operated) and "persons with legitimate interest" access-tier definitions remained pending as of the 2026-09 research pass. Registry/access metadata is therefore **declared-only** in v1 (recorded, not validated); access-tier enforcement is parked (§W).

## §M The embedded matrix (data file spec)

- **Shape:** the matrix is authored as a version-pinned JSON data file for provenance (`repo/data/` precedent: `reg-deadlines.json`) but has **no lawful runtime fetch path** — pages cannot `fetch` (§0 egress gate), the worker vendor regex copies only `.mjs`, and kernels are self-contained — so the build **inlines the 71 rows into both the tool page and the kernel `.mjs`**, generated single-source from the data file with a byte-sync assertion gate `[BT2-6]`. Payload: 71 rows `{ n, name, source, ev, lmt, ind }`; applicability enums per §D table below; top-level `provenance` block: `{ guidance_version: "2.0", guidance_date: "2026-08-15", ares_ref: "Ares(2026)7968937", pdf_sha256: "e045a766…", licence: "CC BY 4.0", licence_uri: "https://creativecommons.org/licenses/by/4.0/", source_url: "<EC PDF URL>", attribution: "European Commission, DG GROW, 'Digital Batteries Passport – data points by category' v2.0 (2026-08-15), CC BY 4.0; adapted" }` (CC BY 4.0 requires credit **and** change indication — licence URI + source link added `[BT-6]`; "adapted" is the change indication since the tool stores a subset/normalization).
- **Applicability enum (kernel vocabulary):** `mandatory` · `optional_if_available` (pt 5) · `conditional` ("if applicable", incl. industrial variants of 31/32/36/37/39, 51–56, 59/60, 57–58, 68–71) · `repetition_dedup` (16, 25 — same data as earlier points; not separately filled) · `deferred_format_tbd` (17, 18) · `deferred_aug2027_art48` (19) · `deferred_delegated_act` (20–23) · `hold_omnibus` (44) · `not_applicable_category` (e.g. 33 LMT+IND; 61 LMT+IND; 62–66 EV) · `dynamic` flag overlay (51 "same as 11 but now dynamic"; **70–71** carry the "periodically recorded" caption — 67 is plain Mandatory and 68–69 "if applicable" with no periodic language, sourced from BR Annex XIII instead) `[BT-5]`.
- **Transcription control:** the file is data, not code; gate G-M verifies `rows.length === 71`, every `source` non-empty, spot-check rows {1, 5, 16, 17, 19, 20, 25, 33, 44, 51, 61, 62, 71} against the pinned PDF text `[BT-8]`, and the P6 counts recompute under the stated rule. Attribution block presence is gated (F8).

## §D Deterministic pipeline — kernel stages (v1)

| Stage | Operation | Determinism notes |
|---|---|---|
| S1 category resolution | Input `battery_category` ∈ {`EV`, `LMT`, `IND`} + capacity/use-case gate for IND (>2 kWh) | Reject unknown categories; no inference |
| S2 matrix projection | Project the 71-row matrix onto the category → required / conditional / deferred(reason) / not-applicable sets | Pure lookup; deferred reasons come from matrix statuses (P5) |
| S3 evidence mapping | Per non-deferred, non-not-applicable point: map `{ evidence_ref, owner, freshness, supplier_chain_ref }` → `satisfied` / `missing` / `conditional_unresolved` (conditional point whose **resolution record** — a per-point `{ point, resolution_ref }` entry with a non-empty `resolution_ref` — is absent) `[BT-3]` / `optional_unfilled` (pt 5 class) | Input order preserved; no fuzzy matching — evidence refs and resolution refs are exact |
| S4 repetition consistency | Points 16/25: confirm the earlier-point data they duplicate is itself present; flag `repetition_gap` if the source point is missing while the duplicate is claimed | Cross-reference only |
| S5 dynamic-data flags | Points with `dynamic` overlay (51, 67–71): readiness requires a freshness-mechanism evidence ref; a static-only submission is flagged `static_only_dynamic_point` | Flag, don't fail — mechanism evidence may legitimately arrive late |
| S6 carrier/registry preconditions (art-115 handoff) | Identifier present, carrier type declared (QR expected), registry metadata **declared-only** (P7) | Unresolvable pending items land in the unresolved ledger, explicitly — never synthesized |
| S7 dossiers + artifact | Emit: readiness artifact (per-point status table + computed counts); **unresolved-points dossier**; **supplier-request dossier** (missing points grouped by `supplier_chain_ref`, groups sorted by supplier ref then point number `[BT-9]`); **deferred-ledger** ({17–23, 44} with reasons); `execution_hash`; `generated_at` visible; guidance-version diagnostic label + Commission disclaimer quote | Canonical JSON: sorted keys, integers/strings only |

## §C Integration

- **New node:** id **RE-MINTED `[BT2-1]`** — `art-77-…` FAILS `check-id-collision.mjs`, which keys on the bare numeric id (art-77 is taken by `art-77-t1-settlement-readiness-diagnostic`, `tools/77-iso-truncation-auditor.html`, and `chaingraph/graph/RESERVATIONS.json` maps `art-77`; BT-7's "full-id uniqueness" premise was wrong about the gate). Mint the next free number per CONTRACT §5.1 (art-692+ at spec date) and reserve it in `RESERVATIONS.json`; `mcp_name = preflight_battery_passport_readiness`, `mandate_type = compliance_mandate`, `gpu: false`, `standards_basis: "Regulation (EU) 2023/1542 Art 77 + Annex XIII; EC Battery Passport guidance v2.0 (2026-08-15)"`, `deadline: 2027-02-18` with capacity-condition `deadline_note`.
- **Chain:** NEW chain `battery-passport-lineage`: `<minted-id> → art-115 → art-116 → art-117`. **Honesty corrections `[BT2-10]` + `[BT2-4]`:** handoffs are navigational prose, not dataflow — art-115's kernel takes `{product_id, data_carrier_type, elements, ontology_version}` and cannot consume a readiness artifact; and the doorway census scores art-116 (the chain's middle stage) BROKEN through the agent door. Do NOT copy the grandfathered "feeds…" handoffs onto the new page — a page absent from the register baseline must carry ZERO causation-verb handoffs or `check-chain-handoff-register.mjs` reds; write all three in sequence-only register ("then validate the data carrier"…). Registration: append the chain name to `chaingraph.meta.json` `order.chains` in the PR (main-side `--enroll` covers node shards only) and declare a registered `domain` `[BT2-5]`. The generic `digital-product-passport-lineage` chain is untouched.
- **Projection:** MCP / WebMCP / Helm through existing generators after the fixture wave (report §3 guardrail).

## §F Conformance fixtures (golden set, all synthetic identifiers)

F1: per-category mandatory counts recompute to EV 47 / LMT 50 / IND 32 · F2: deferred ledger == {17, 18, 19, 20, 21, 22, 23, 44} with per-point reasons from the matrix · F3: SOH split (61 EV-only; 62–66 LMT; industrial conditional) · F4: repetition points 16/25 with source point missing → `repetition_gap` · F5: EV complete evidence set → `satisfied` across the projected set · F6: conditional point without resolution → `conditional_unresolved` (never silently required or dropped) · F7: determinism — identical inputs → byte-identical artifact (modulo `generated_at`, per CONTRACT §1.5.1; the same conflict the PCI seat found as PA-2, applied cross-spec), twice · F8: attribution + licence URI + source link + "adapted" indication + disclaimer present in artifact and page footer `[BT-6]` · F9: pt 5 optional-if-available path → `optional_unfilled`, never silently required `[BT-4]` · F10: pt 51 static-only submission → `static_only_dynamic_point` flagged, not failed `[BT-4]`.

## §X Explicitly out of scope (v1)

Not a passport generator, host, or registry submission path · no access-tier enforcement (registry IA pending, P7) · no carbon-footprint math (points 17–18 deferred) · no conformance/legal verdict of any kind — guidance-version diagnostic only · no supplier outreach automation (dossiers are outputs for humans) · no network I/O (§0) · no real battery identifiers, serials, or production data in fixtures.

## §W Parked (dated observations, each promising nothing)

- **Access-tier module** (public / legitimate-interest / authorities split of points) — on the registry implementing act + "legitimate interest" definitions. (2026-09-23)
- **Carbon-footprint module** — on the implementing act specifying formats for points 17–18. (2026-09-23)
- **Format/units conformance checks** — the guidance itself flags formats as possible future additions; adopt on guidance v2.x. (2026-09-23)
- **Guidance re-version watch** — any v2.x re-pins the PDF + sha256 and re-runs F1/F2 derivation. (2026-09-23)

## §J Rejected alternatives (so the ORCH does not re-litigate)

- **Extending the generic DPP chain with a battery stage:** rejected — forces battery-specific applicability onto generic DPP users and duplicates the carrier-validation concern the report explicitly assigns to art-115 ("feed art-115, don't duplicate it").
- **Encoding guidance prose as mandatory fields:** rejected — the report's own guardrail and P2's disclaimer forbid converting "format still to be specified" into synthetic requirements; deferred points stay deferred in the data.
- **Scraping third-party trackers for counts/status:** rejected — traceable.digital et al. are cross-checks only (P6); all logic derives from the pinned primary.
- **A hosted battery-passport registry integration:** rejected — §0 posture ("evidence before action"); the estate assembles evidence, not registrations.

## §K Risks & mitigations

| Risk | Mitigation |
|---|---|
| Matrix transcription error | G-M spot-check rows + F1/F2 recomputation gates against the pinned PDF |
| Authority drift (v2.x, implementing acts, Omnibus outcome on pt 44) | §W watches; `provenance.guidance_version` stamped in every artifact so stale-matrix outputs are self-identifying |
| Over-claim (tool read as conformance certification) | Fixed disclaimer + guidance-version label on page and artifact (F8); CONTRACT §1.5 all-states rendering |
| Deadline misread as applying to all batteries | `deadline_note` carries the category/capacity condition verbatim (EV, LMT, industrial >2 kWh) |
| Licence breach in the embedded matrix | F8 attribution + "adapted" indication gate; CC BY 4.0 noted in §M provenance block |
| Pending acts silently treated as final | P7 declared-only posture; unresolved ledger named explicitly in every artifact |

## §T Staging — UNMINTED

Proposed single row `BATTERY-PASSPORT-READINESS-1` (repo: site; fence: §M + §D + §C + §F; gates: chaingraph/manifest validation, G-M matrix gates, copy-hallmarks, site-egress, tool-name uniqueness, generated-artifact ownership, `verify_repo.py`, worker `generate.mjs` same-push). Awaiting ruling; ORCH mints per SO #30.

## §R2 Pass-2 amendments (estate-value + breakage seats, 2026-09-23) — all ACCEPTED and folded

> Findings + dispositions: `BATTERY-PASSPORT-READINESS-ADVERSARIAL-REVIEW-2026-09-23.md` §Pass 2. Inline `[BT2-n]` corrections sit in §C/§M; the rest fold here.

- **`[BT2-9]` Audience bet — GATING RULING.** The estate's own `llms.txt` audience is "payments engineers, compliance officers, treasury analysts, and quant teams"; the battery-manufacturer compliance officer is a persona with zero estate content and zero usage evidence. The row stages only if the ruling explicitly buys the vertical, not just the build.
- **`[BT2-11]` v1 scope option (seat-preferred).** The ~47/50/32-tuple evidence map exceeds every observed estate input idiom (heaviest precedent: 3 array props; Helm cannot supply run inputs at all). Ruling option: ship v1 as **matrix reference + category projection + deferred ledger** (S1/S2/S7) with computed counts, demoting S3–S5 to the parked list.
- **`[BT2-12]` Moving-target ownership.** The estate is not the regulated party; the 2027-02-18 clock binds suppliers, not us. §W watches are owned by a standing WATCH row (v2.x, registry IA, Omnibus, Art 8 act) with a named re-pin cadence, not by the build row.
- **`[BT2-13]` Prefix-sort gate.** No surface may sort/index nodes by bare numeric prefix without the slug (the estate already mis-resolved `art-391` once — STATE.md).
- **`[BT2-14]` Generator touch-list (fence enumeration).** Node shard + `chaingraph.meta.json` (order.nodes AND order.chains) + clause-snapshot registry + `hub-categories.json` + `check-node-page-chrome.mjs` (canonical header/footer — corpus-wide per the STP riders) + the `mcp.html` workflows-table recipe row + `search-index.json` + catalog regen + start-index + sitemap + worker re-vendor.
- **`[BT2-3]` §18 compute proof.** As PCI: well-formed `compute_proof` or `compute_proof_ready:"deferred"` + reason + in-PR `compute-proof-baseline.json` bump.
- **`[BT2-2]` Enum + clause digest + required fields.** `standards_basis` is the §30 enum; BR Art 77 / Annex XIII clauses need `cited_clause_digest[]` via `pin-clause-snapshot.mjs` (repo registry — workspace snapshots don't count); the shard carries all 14 schema-required fields; `consumes`/`feeds` declared both directions on the new edges (`check-chain-edge-contracts.mjs`).
- **`[BT2-8]` Copy screening.** The quoted EC disclaimer/attribution text goes through copy-hallmarks screening at build time — unbaselined pages have zero allowance for em-dashes and anti-AI-tells, so the quote is punctuation-adjusted or baselined.
- **`[BT2-7]` Staging.** Re-vendor from post-bot-commit `origin/main`, never the PR branch (same trap as PCI's PA2-7).

## §STP posture (2026-09-23 — assessed against `STP-WAVE-COMPLIANCE-RIDERS.md` + `STP-BRANCHABILITY-BUILD-SPEC.md` rev 2)

**Classification ships; decision does not.** The readiness artifact's statuses are machine-readable classifications, never auto-decisions: what counts as "ready enough" lives in a caller's signed §22 Work Mandate, not in this node (SWORN test 3; §X — which also rejects supplier-outreach automation, the tempting STP-shaped side effect here).

- **Gate-authorable output `[STP-2]`.** The S7 `output_payload` exposes two stable pointers for future §21.4 gate authors: the readiness status, and the per-point status array — aligned with the predictable-decision-pointer work (`research/stp-decision-pointer-draft-2026-09-22.md`) when it lands; until then both pointers are recorded in the manifest (branchability spec's gap: gate authors must not need bespoke knowledge of this node's shape).
- **No §21.4 gates in v1.** `battery-passport-lineage` is navigational prose (and art-116 is census-BROKEN through the agent door), so gating would demand execution machinery the chain does not have. If it ever becomes executable, the obvious gate is readiness-status routing (ready → carrier validation; gaps → end), with both-branch fixtures per the riders' worker `gate-branch-coverage` requirement.
- **Riders adopted even though this is not an STP-wave build:** per-kernel conformance fixtures (already §F), canonical node-page chrome (`check-node-page-chrome.mjs` — corpus-wide, added to §R2), and version-pinned tables with source citations (the matrix IS the pinned table: guidance version + sha256 fold into §17 kernel identity). **Decision-receipt export parked:** riders item 5 binds only when a row emits a compliance decision — v1 deliberately does not.

## §SWORN conformance (2026-09-23 — audited against the five-test filter in `FINTECH-SAAS-SWORN-BORROW-SCAN-2026-09-23.md`, grounded in SPEC.md §§16–27 + CONTRACT §0)

**No API anywhere.** Runtime: S1–S7 operate over user-supplied evidence. Three surfaces are pinned pattern-only / declared-only by design `[SW-3]`: (1) registry metadata is **declared-only** (P7) — the node performs no registry lookup and cannot (the registry implementing act does not exist yet); (2) GS1 Digital Link appears as an identifier **pattern only and is never resolved** — the art-115 precedent is exactly this (carrier type is an enum string in the kernel; no estate kernel resolves a link); (3) CIRPASS-2 ontology alignment follows the art-115 vendored-constant pattern (inline canonical element set — no runtime ontology fetch). Build time: authority pins are human downloads; projection: estate-internal zero-egress kernel surfaces, no new worker route.

| SWORN test | Verdict | Basis |
|---|---|---|
| 1 Offline continuity | PASS | Deterministic artifact + `execution_hash`; the matrix is embedded (§M), so the readiness check works with no network and no EC site |
| 2 Customer control | PASS | Zero egress; supplier evidence never leaves the session; dossiers are files for the user, not submissions to anyone |
| 3 No authority capture | PASS | The node never decides a battery passport is compliant, complete, or accepted; deferred points stay deferred in the data; the guidance-version diagnostic label is load-bearing |
| 4 Separate trust labels | **TIGHTENED `[SW-4]`** | Artifact fields carry exactly one of `source_asserted` (evidence refs, owners, declared registry metadata), `kernel_computed` (matrix projections, counts, dedup checks), `human_attested` (conditional resolutions, freshness claims). No upgrade path between labels |
| 5 Bounded side effects | PASS | Evidence-only; §X rejects registry submission and supplier outreach — there is no side effect to bound |

`[SW-4]` mirrors the PCI spec: the S7 artifact schema and page rendering MUST carry the three trust labels as distinct field classes, tested by fixtures. **Future-API guard `[SW-5]`:** any future "check against the live registry" feature would require either a user-supplied registry export (network-denied, SWORN-reviewable) or a live network call (rejected); a builder cannot add query integration without a new ruling.

## Sources

[EC guidance announcement (2026-08-21)](https://single-market-economy.ec.europa.eu/news/guidance-support-preparations-digital-batteries-passport-2026-08-21_en) · [EC data-point PDF v2.0 (pinned locally, sha256 e045a766…)](https://single-market-economy.ec.europa.eu/document/download/cd1e5e6c-4a4a-4b99-995a-49eb6916187e_en) · [EUR-Lex 2023/1542 consolidated 20250731](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1542) · [DPP Vocabulary Hub — CIRPASS-2 ontologies](https://dpp.vocabulary-hub.eu) · [Global Battery Alliance (registry IA pending, 2026-03)](https://www.globalbattery.org) · traceable.digital (cross-check only, §J).
