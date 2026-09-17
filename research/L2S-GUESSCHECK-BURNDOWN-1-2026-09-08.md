# L2S-GUESSCHECK-BURNDOWN-1 — burn-down report (2026-09-08)

Row: `board/queued/L2S-GUESSCHECK-BURNDOWN-1.md` (staged 2026-09-04). Worktree:
`C:\dev\Claude\Projects\AINumbers\.wt\L2S-GUESSCHECK-BURNDOWN-1`, branch
`L2S-GUESSCHECK-BURNDOWN-1`, rebased onto fresh `origin/main` `da54d1ec` (the
dispatch's `7df78b86` had been superseded by one commit, `ASKAGENT-CALLSHAPE-1 #1820`).

## 1. Method, exactly as the row specifies

Guess-and-check: a candidate shared-input-field contract is drafted from the
producing/consuming tools' ACTUAL semantics, then the EXISTING L2-S checker
(`scripts/check-chain-l2-contracts.mjs`, untouched) validates it. The checker
stays the only trust anchor. The gate-internal-LLM ban is untouched: no checker
reads an LLM, every landed constraint was accepted by the session (HIGH judgment)
and only after the checker confirmed the field decision. One substitution is
disclosed: the row's "LOW subagents for drafting" could not be dispatched in this
harness (builder tool grant: Read/Grep/Glob/Bash/Edit/Write only), so drafting ran
in-session under the same discipline.

Evidence standard for a drafted domain (estate precedent: `chaingraph/art-07`
and `art-08` published `input_schema` blocks):

- `<select>`-fed field: the option-value set is the tool's closed input vocabulary; land `enum`.
- `<input type=number|range min=.. max=..>`: the form-enforced bounds; land `minimum`/`maximum` (the art-07/08 shape).
- free-text inputs, unvalidated numerics, arrays: NO domain is drafted. A bound
  the code never enforces would be fabrication (MANIFEST-SCHEMA-BACKFILL-1's
  "never guess" rule; CHAIN-FV-L2-CLOSEOUT-1's "never widen a schema to make a
  gate pass"). Such fields are dispositioned UNCONTRACTABLE with the reason named.

Edit shape (all 32 files): constraint keys (`enum`/`minimum`/`maximum`) inserted
into `input_schema.properties.<field>` ONLY. No `type` changed, no property added
or removed, no `required` change, and `mcp_tool_definition.inputSchema` (the
WebMCP emission surface) byte-untouched, verified per edit by the applier.
Reason: `checkManifestSchemaParity` (G1b) compares property sets/required/type,
so both schema-writer slots stay in agreement; the WebMCP freshness gate reads
only the emission surface, which never moved.

## 2. Advisory-count movement (the row's before/after duty)

Command: `node scripts/check-chain-l2-contracts.mjs --json` (before edits and
after each wave). The preflight advisory line format:
`L2-S: <pass> pass / <fail> fail / <ind> indeterminate over 181 shared input fields, estate-wide`.

| Batch | Chains (row plan ~20/batch) | Edits | Advisory line after batch |
|---|---|---|---|
| before | (99 indeterminate chains) | 0 | `L2-S: 5 pass / 2 fail / 99 indeterminate over 181 shared input fields` |
| 1 | x402-spend-evidence .. crypto-tax-reporting (20) | 30 pairs / 27 files | `12 pass / 2 fail / 92 indeterminate` (closed: baas-sponsor-bank, basel-endgame-frtb-capital, ccd2-consumer-credit, embedded-finance-licensing, genius-act-issuer-licensing, sme-credit-intelligence, sme-finance-lending) |
| 2 | dlt-network-governance .. agent-economy-fraud-runtime (20) | 9 pairs / 9 files | `17 pass / 2 fail / 87 indeterminate` (closed: basel-iv-capital-stress, dlt-network-governance, marketplace-platform-payments, payment-economics-benchmarking, stablecoin-reserve) |
| 3 | aca-226j-response-composer .. conditional-relief-collateral (20) | 0 (all 20 chains are 100% byte-locked or no-evidenced-domain; see §5) | `17 pass / 2 fail / 87 indeterminate` (unchanged by construction) |
| 4 | corporate-action-entitlement .. mortgage-compliance-preflight (20) | 0 (same) | unchanged |
| 5 | mortgage-government-loan-fit .. y9c-schedule-hc-hcr-capital (19) | 0 (same) | unchanged |

FINAL (checker re-run after the last edit):
`17 pass / 2 fail / 87 indeterminate over 181 shared fields`, 5 → 17 pass,
99 → 87 indeterminate, 12 chains closed. Regression guard over the full estate:
zero chains changed verdict except indeterminate→pass; the 2 L2S-fail chains
(`dora-operational-resilience`, `rtp-participation`) and their fail codes are
byte-identical before/after (`{"gate-pointer-unresolved":2}`; those are L2-G
edge findings, not L2-S). No pass chain degraded. No new fail anywhere.

## 3. The 39 landed contracts (vacuity check included)

Every landed domain CONSTRAINS: each `enum` is a finite subset of the string
type's infinite set, each numeric bound excludes values the bare type admits.
Spot-checks (per batch): 158 `progType` excludes the free-form values its bare
`string` allowed; 474 `fy` [2024,2035] excludes 2023 and 2036 (which the bare
integer admitted); 241 `dscr` [0,10] excludes 11; 328 `outstanding_usd`
min 1,000,000 excludes 999,999 and every negative; 12 `avgTransaction` min 1
excludes 0.5. No landed key restates a type; no landed domain is the full set
the type admits.

| tool :: field | landed domain | evidence |
|---|---|---|
| 12-fee-benchmark-report :: avgTransaction | minimum 1 | page control `avg-ticket` min=1 |
| 85-card-economics-optimizer :: avgTransaction | minimum 0.01 | page control `avgTxn` min=0.01 |
| 151-split-payment-escrow-simulator :: reservePct | [0,20] | range slider min=0 max=20 |
| 159-marketplace-payout-flow-designer :: reservePct | [0,30] | number input min=0 max=30 |
| 158-fintech-compliance-control-mapper :: progType | enum 5 | page select options |
| 162-sponsor-bank-readiness-scorer :: progType | enum 4 | page select options |
| 193-bnpl-apr-calculator :: currency | [GBP,EUR,USD] | page select options |
| 203-raroc-loan-pricing-model :: maturity_years | [0.25,30] | input min=0.25 max=30 |
| 239-sme-credit-risk-scoring :: sector | enum 10 | page select options |
| 240-working-capital-gap-calculator :: sector | enum 8 | page select options |
| 241-business-loan-readiness-checker :: currency | [GBP,USD,EUR] | page select options |
| 241-business-loan-readiness-checker :: dscr | [0,10] | input min=0 max=10 |
| 241-business-loan-readiness-checker :: revenue | minimum 1 | input min=1 + JS "positive revenue" error |
| 242-invoice-finance-eligibility :: currency | [GBP,USD,EUR] | page select options |
| 245-government-funding-grant-mapper :: currency | [GBP,USD,EUR] | page select options |
| 245-government-funding-grant-mapper :: sector | enum 9 | page select options |
| 246-sme-cashflow-stress-test :: currency | [GBP,USD,EUR] | page select options |
| 247-lending-covenant-monitoring :: currency | [GBP,USD,EUR] | page select options |
| 304-dora-resilience-testing-designer :: doraClass | [significant,standard,micro] | page select options |
| 304-dora-resilience-testing-designer :: entityType | enum 9 | page select options |
| 304-dora-resilience-testing-designer :: nca | enum 11 | page select options |
| 307-dora-proportionality-assessment :: entityType | enum 17 | page select options |
| 308-dora-nca-submission-tracker :: doraClass | [significant,standard,simplified] | page select options |
| 308-dora-nca-submission-tracker :: nca | enum 13 | page select options |
| 328-genius-act-reserve-optimizer :: outstanding_usd | minimum 1000000 | input min=1000000 |
| 336-genius-act-issuer-classification-mapper :: outstanding_usd | minimum 0 | input min=0 |
| 337-genius-act-reserve-attestation-checklist :: outstanding_usd | minimum 1000000 | input min=1000000 |
| 339-sr2602-model-risk-mgmt-gap-analyzer :: total_assets_bn | minimum 0.1 | input min=0.1 |
| 341-basel-iii-endgame-capital-impact-estimator :: total_assets_bn | minimum 1 | input min=1 |
| 474-topup-tax-qdmtt-calculator :: fy | [2024,2035] | input min=2024 max=2035 |
| 475-pillar-two-safe-harbour-checker :: fy | enum [2023..2027] | page select options (integers; declared type integer kept) |
| 476-gir-builder :: fy | [2024,2035] | input min=2024 max=2035 |
| 481-ccd2-scope-classifier :: amount_eur | minimum 0 | input min=0 |
| 482-ccd2-creditworthiness-assessment-builder :: amount_eur | minimum 0 | input min=0 |
| 482-ccd2-creditworthiness-assessment-builder :: product_type | enum 7 | page select options |
| 54-smart-contract-validator :: platform | [corda,fabric] | page select options |
| 66-rwa-tokenization-cost-model :: platform | enum 5 | page select options |
| 70-node-topology-modeler :: platform | enum 4 | page select options |
| 71-dlt-guardrail-builder :: platform | [both,besu,corda] | page select options |

## 4. The guess-and-check counterexamples (discovered real contradictions)

Six drafted-field instances FAILED the checker's consistency semantics when both
sides of a shared field were contracted. One redraft was attempted per case; no
honest redraft exists (the vocabularies genuinely name different sets), so both
sides stay UNCONTRACTED and the field stays indeterminate. These are new L2-S
leads (real published contradictions between our own manifests), reported not
buried, for follow-on rows:

1. `kyc-onboarding-cdd . entityType`: 109-cdd-edd-checklist customer-segment set
   [retail,sme,corporate,pep,hrnc,correspondent,msb,vasp] vs 111-kyb-ubo-mapper
   legal-structure set [llc,trust,foundation,partnership,shell]. Same field name,
   two different concepts.
2. `emerging-market-fx-corridor . corridor`: 220-correspondent-derisking-modeler
   country-pair codes [US_PK,US_NG,US_SO,EU_MW,UK_ZW,AU_FJ,US_CU,US_SY] vs locked
   325-payment-cutoff-settlement-atlas region-pair codes
   [US-DOM,UK-DOM,EU-DOM,US-UK,US-EU,UK-EU,GLOBAL,BR-DOM,IN-DOM,AU-DOM,CN-DOM].
3. `sme-government-grants-funding . businessType`: 245 [startup,scaleup,established,
   social,university] vs locked 244-revenue-based-finance-calculator
   [saas,ecomm,services,marketplace,other].
4. `stablecoin-issuer-genius-mica . issuer_type`: 328 [national_bank,state_bank_fed,
   fdic_bank,federal_ppsi,state_ppsi,foreign] vs locked 510-digital-asset-regulatory-classifier
   [bank,payment_institution,investment_firm,fund,other].
5. `financial-crime-compliance . channel`: 110 numeric-string select [1,2,3] vs
   477-fatf-customer-risk-rating published enum [face_to_face,non_face_verified,
   digital_biometric,agent_intermediary,correspondent_nested,anonymous].
6. `emerging-market-fx-corridor . currency`: 157-settlement-orchestration-simulator
   majors [USD,EUR,GBP,SGD,HKD,JPY,AUD] vs 217-em-fx-risk-classifier 29-currency
   EM-only set (MXN,BRL,CLP,COP,PEN,ARS,INR,CNY,KRW,IDR,MYR,PHP,THB,VND,PKR,PLN,
   HUF,CZK,RON,TRY,ZAR,NGN,KES,GHS,AED,SAR,ILS,EGP,MAD). Disjoint by construction.
7. `dora-resilience . entityType`: 303 kebab-case [bank,payment-institution,
   e-money-firm,investment-firm,casp] vs 304/307/308 snake_case
   [credit_inst,payment_inst,...]. (Not landed for 303; 304/307/308 DID land
   because their pairwise instances with each other intersect; the dora-resilience
   instance keeps 303 at no-domain, so it stays indeterminate, not fail.)
8. `neobank-baas . progType`: 163 [debit,prepaid,credit] vs 162
   [debit_card,credit_card,stored_value,lending]. 162 landed (closes
   baas-sponsor-bank and embedded-finance-licensing); 163 not landed, so
   neobank-baas stays indeterminate.

## 5. The 87 residual chains, fully dispositioned

Reason classes (a chain is counted in every class that blocks it):

- **64 chains byte-locked.** Every blocking `no-domain` participant is a
  provenance-marked manifest (`x_schema_provenance: derived-from-kernel-reads
  2026-09-01`). `scripts/gen-input-schemas.mjs --check` (a HARD preflight gate,
  MANIFEST-SCHEMA-BACKFILL-1's ownership mark) byte-matches those blocks against
  fresh kernel derivations and reds ANY hand edit: "input_schema drifted from the
  kernel's measured reads - hand-edits to derived schemas are red". There is
  therefore no legal authoring site for a constraint on those fields today.
  ⛔ FLAGGED for a follow-on row: an override lane in `gen-input-schemas.mjs`
  (declared contract file folded into the derivation so `--check` stays honest and
  hand-edits stay red) would unlock this class. This row did NOT edit that
  generator (its fence belongs to the done backfill row).
- **21 chains no-evidenced-domain.** Blockers are hand-curated tools whose
  fields are free text (tppName, entityName, merchant, nonce, verifyingContract,
  useCase, parent_hq, jurisdiction), unvalidated numerics (ctppCount, totalAssets,
  notional, seed, now_unix, chainId, validAfter/validBefore), or arrays
  (jurisdictions, disposals, roles, systems, cart_items, legs, positions,
  exposures, document, payload). A bound or whitelist the code never enforces
  would be fabricated; arrays additionally sit outside the L2-S constraint
  vocabulary entirely (below).
- **2 chains mixed** byte-lock + no-evidenced-domain.
- **Checker vocabulary gap (flagged, not edited):** `extractConstraint` reads only
  top-level scalar bounds (minimum/maximum/exclusive*/multipleOf/enum/const).
  Array fields whose pages publish `items.enum` (187/191 `jurisdictions`) cannot
  be contracted without a checker edit, which this row's fence forbids
  ("HALT-and-flag if the checker itself needs changes"). Flagged for a follow-on.
- **2 pairs out of scope:** the only (tool,field) pairs whose sole field-instances
  live in the 2 pre-existing L2S-fail chains were left untouched (they cannot move
  the advisory counts and any edit there risks a new fail code).

Full per-chain blocker tables (field, missing participants, class) were derived
from the live checker reports saved during the run
(`l2s-before.json` / `l2s-after-final.json` snapshots of
`check-chain-l2-contracts.mjs --json`) and are reproduced in the row's check-off.

## 6. Gates run on the worktree

- `node scripts/check-manifest-schema.mjs` → `✓ manifest-schema clean — 1184 manifests checked, 0 pre-existing violation(s) shielded by baseline, 0 new.`
- `node scripts/gen-input-schemas.mjs --check` → `✓ input-schema backfill freshness clean — 538 provenance-marked schema(s) byte-match fresh derivations from kernel reads.`
- `node scripts/gen-webmcp-registrations.mjs --check` → `✓ webmcp-registration freshness clean — 96 generated registration(s) byte-exact vs their manifests, 358 chain composer page(s) byte-exact in chain mode`
- `node scripts/check-chain-l2-contracts.mjs --json` → before `5/2/99 over 181`, after `17/2/87 over 181`, `fail_code_counts` identical.
- `node repo/scripts/preflight.mjs --quick` → see check-off (run before push).

## 7. Fences

Contract files touched: 32 `manifests/*.manifest.json` (input_schema constraint
keys only) plus this report. Zero checker-logic edits
(`scripts/check-chain-l2-contracts.mjs` untouched; verified by `git status`),
zero kernel edits, zero `chaingraph.json`, zero node-shard, zero tool-page, zero
`mcp_tool_definition` bytes. The two machine flags (§5) name exactly the
machinery this row could not touch and the follow-on shape each needs.
