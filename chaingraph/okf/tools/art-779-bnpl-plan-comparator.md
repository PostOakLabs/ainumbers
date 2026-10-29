---
type: DecisionTool
title: "BNPL Plan Comparator"
description: "Side-by-side BNPL plan cost comparison on the estate's Reg Z APR maths: the APR for every plan is computed by the estate's art-215 solver compute_reg_z_appendix_j_apr (12 CFR 1026 Appendix J general actuarial equation, bracketed bisection), carried in this kernel verbatim between ART-215-SOLVER-INLINE sentinels per the composition contract, with the live art-215 module enforced equal by the proptest's parity property. Inputs: a USD principal plus 1 to 8 plans, each either a provider preset or explicit parameters (number of instalments, cadence weekly, biweekly or monthly, stated APR, upfront and per-instalment fees, optional quoted instalment amount and down payment). Outputs per plan: the payment schedule with each instalment's due period from purchase and amount, total of payments, fee total, finance charge, and the Reg Z Appendix J APR of the stream (null with a named flag when no rate is bracketed), plus a comparison ranking plans by total of payments. Provider presets are labelled examples quoted from dated primary-text snapshots, never an offer: PayPal Pay in 4 (P1: four interest-free biweekly instalments, first at purchase, $10 to $2,000 band, lender PayPal, Inc. NMLS# 910457), Klarna Pay in 4 (K1) plus its apply-in-advance service-fee labelled example ($248 purchase, $62 down and three biweekly $62, $4.99 service fee, 35.68% APR stated, WebBank, K2), Afterpay Pay in 4 (A1/A2) plus its finance-fee labelled example ($110 loan, $27.50 down and three biweekly $28.26, 36% APR stated, First Electronic Bank for fee-bearing loans, A1), and Affirm at 0 to 36% APR with its $400 monthly labelled example ($80 down, 12 monthly $28.88, 15% APR stated) and $400 pay-in-4 labelled example (four biweekly $100, 0% APR) (F1/F2), all fetched 2026-10-28 from research/clause-snapshots/bnpl-paypal-2026-10/SNAPSHOT.md, bnpl-klarna-2026-10, bnpl-afterpay-2026-10 and bnpl-affirm-2026-10 (row BNPL-TERMS-PRIMARY-TEXT-1). Terms vary by provider, merchant and credit decision: every preset carries the provider's own qualifier quotes, its lender of record where stated, and its late-fee clause as information only, because late fees are contingent on missed payments and never part of a schedule. An interest-bearing custom plan must carry its quoted instalment amount: this node compares quoted plans and does not originate an amortizing schedule. Unknown preset, unknown cadence, preset and explicit fields together, invalid principal, instalment count, fee or APR values, non-USD currency, more than 8 plans and an empty plan list are refused by name. Zero network, zero PII, synthetic values only."
resource: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html
tags: ["compliance_mandate", "wave-137", "mcp:compare_bnpl_plans"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-779-bnpl-plan-comparator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html
    title: "public tool page"
---

# BNPL Plan Comparator

> Exports a decision via MCP `compare_bnpl_plans` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline: this node compares plan costs, it does not track a dated obligation.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-779-bnpl-plan-comparator.md) — §10.2.
