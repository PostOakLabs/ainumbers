# CHAIN-DOMAIN-REGISTER-1 — 2026-07-26

## Live enum (quoted verbatim from `scripts/check-chain-domain.mjs`, 36 values)

Agent Economy · AI Governance · AI & Agent Governance · Audit & Assurance · BaaS & Embedded Finance · Bank Capital & Credit Risk · CBAM · Card & Payment Economics · Climate & Sustainable Finance · Consumer & Wealth Compliance · Consumer Lending & Fair Lending · Corporate Treasury & FX · Cross-Border & Instant Payments · Digital Trade · Digital-Asset Rails · DORA / NIS2 / ICT Resilience · Document & Content Provenance · EMIR · EU Digital ID & Consumer Credit · EUDR · Export Control · Financial Crime & KYC · Fraud & Dispute · HR & Benefits Compliance · IRRBB · Insurance & Reinsurance · Open Banking / Open Finance · Post-Quantum Cryptography · SME & Commercial Finance · Sanctions · Securities Settlement · SOX 404 / ICFR · Settlement Discipline · Supply-Chain Traceability · Treasury Clearing · ViDA / E-Invoicing · Verification & Proof Receipts · Wholesale Settlement

## Job 1 — mapping (all 3 map to EXISTING enum values; no new value needed)

- **`aml-lookback-cycle` → `Sanctions`** (was invalid `"AML Consent-Order Remediation"`). Justification: every step is a sanctions-screening step — `art-90-sanctions-screening-fit-diagnostic`, `art-97-sanctions-screening-quality-scorer` — and the description's substantive action is re-screening the verifiable population "against the sanctions/export-control program in force." `Financial Crime & KYC` was considered and rejected as too broad/generic next to the more precise `Sanctions` bucket that the chain's own tool names name directly.
- **`cbcr-annual-publish` → `Audit & Assurance`** (was invalid `"Tax & Transfer Pricing"`, not an enum value). Justification: the chain's substance is an assured, gated public disclosure artifact — internal consistency gates, `anomaly_flags`, and a `dual_control(2)` preparer/tax-officer sign-off gate before disclosure — i.e. an assurance/attestation workflow over financial data, not a tax-computation tool. `SOX 404 / ICFR` was considered and rejected: that bucket is for internal-controls-over-financial-reporting mandates specifically, not an OECD BEPS public tax transparency filing.
- **`vop-liability-evidence` → `Fraud & Dispute`** (was invalid `"Payments Compliance"`, not an enum value). Justification: the chain builds the evidence pack a PSP presents in an "APP-fraud reimbursement liability review" — this is squarely a fraud/dispute-evidence workflow. No other bucket considered a closer fit.

## Job 2 — scope discipline

Only the `domain` field was edited in each of the 3 shard files (`chaingraph/graph/chains/{aml-lookback-cycle,cbcr-annual-publish,vop-liability-evidence}.json`) — confirmed via `git diff --stat` (1 line changed per file). `scripts/check-chain-domain.mjs` was NOT edited — no new enum value was needed.

## Job 3 — assemble

The 3 shards existed on disk but were **not yet in `chaingraph.meta.json`'s `order.chains`** (confirmed: absent from both the pre-edit committed `chaingraph.json` AND from a first assemble run after only the domain edits — count stayed 322/477 either way). This is outside the row's literal fence (which lists `chaingraph.json` but not `chaingraph.meta.json`), but Job 3's explicit "assemble the three" + "expect +3" instruction is unachievable without it — `scripts/assemble-chaingraph.mjs` reads `order.nodes`/`order.chains` as the authoritative SET of shards to include, not a directory scan. Treated this as within the row's clear intent and appended the 3 chain names to `order.chains` (append-only, no other meta.json change).

- **Before:** 322 chains / 477 nodes (verified live via `node -e "require('./chaingraph/chaingraph.json')"` in a fresh worktree off `origin/main`, matching `PR #666`'s post-`pqc-migration-evidence` state).
- **After `node scripts/assemble-chaingraph.mjs`:** `Wrote chaingraph.json (477 nodes, 325 chains)` — **+3 chains, 0 node delta**, exactly the shards assembled. Reconciled.

## Job 4 — validation

Full `node scripts/preflight.mjs` run **green** (after regenerating 3 downstream freshness artifacts the new chains triggered: `gen-llms-full.mjs`, `gen-workbench.mjs`, `gen-canvas.mjs` — all `--check` gates in preflight, all now pass). `check-chain-domain.mjs` standalone: `✓ chain-domain clean — all 325 chains carry a valid domain across 38 buckets (largest: "Digital-Asset Rails" 64/325 = 19.7%)` — no bucket over the 25% concentration ceiling.

`tool_id` resolution (node identity = `nodes[].tool_id`, per `BANK-CHAINS-1` lesson — never `n.id`/`n.name`): all 7 steps across the 3 chains resolve directly against `chaingraph.json`'s `nodes[].tool_id` set — `art-470-lookback-completeness-reconciler`, `art-90-sanctions-screening-fit-diagnostic`, `art-97-sanctions-screening-quality-scorer`, `art-471-disposition-sampling-frame`, `art-472-cbcr-builder`, `art-376-score-payee-name-match`, `art-377-build-vop-session-receipt`. **Zero unresolved / bare-numeric steps** — nothing to hand to `CHAIN-REF-INTEGRITY-1`.

§18 gates: `§18 compute-integrity (unit)`, `§18 compute-proof coverage`, `§18 digest-freshness ratchet (S18-DIGEST-GATE-1)` all ran and passed as part of preflight — **UNMOVED**, no chain in this row adds a kernel or a proof, digest-freshness baseline untouched.

## Result

**3-of-3 assembled.** Chain count `322 → 325` (nodes unmoved at 477). Draft PR carries: 3 shard domain edits, `chaingraph.meta.json` `order.chains` append, regenerated `chaingraph.json`/`chaingraph-hub.html`/`llms-full.txt`/`workbench.html`/`canvas.html`/count sentinels, this doc.
