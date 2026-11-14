---
type: DecisionTool
title: "Stablecoin Cash Equivalent Test (FASB Proposed 2026-08)"
description: "Applies the FASB proposed Update of 2026-08-18 (Statement of Cash Flows (Topic 230): Cash Equivalents-Disclosure Enhancement and Evaluation of Certain Digital Assets, exposure draft, comments due 2026-11-19) to the DECLARED redemption and reserve terms of one stablecoin holding, criterion by criterion, and returns per-criterion PASS / FAIL / NOT_DETERMINABLE verdicts, a collective classification (MEETS_PROPOSED_EXAMPLES / DOES_NOT_MEET / NOT_DETERMINABLE) always labelled with the proposal status, the disclosure checklist the text proposes, and a Policy Mandate export of the declared terms and result. Inputs are declared terms only: direct issuer redemption right, on-demand redeemability, known redemption amount, gates or suspension terms, intermediary-only access, segregated one-to-one short-term liquid reserves, original maturity, and a declared law-or-regulation prohibition term. Secondary-market salability alone never qualifies (the pinned Case-B boundary). Significance thresholds for fees and minimums are declared policy parameters, not values from the text. SCOPE LIMITS: the node evaluates declared terms only and never says how an entity must account, presenting a qualifying asset as a cash equivalent is an accounting policy election; this page is not an accounting opinion. Issuer reserve adequacy and issuer disclosure evidence is served by other estate nodes (art-06, art-275, art-582); this node consumes no issuer evidence. Refuses any input outside the declared shape; a missing (as opposed to type-invalid) required term yields NOT_DETERMINABLE, not a guess."
resource: https://ainumbers.co/chaingraph/797-stablecoin-cash-equivalent-test.html
tags: ["compliance_control", "wave-141", "mcp:check_stablecoin_cash_equiv"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/797-stablecoin-cash-equivalent-test.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/797-stablecoin-cash-equivalent-test.html
    title: "public tool page"
---

# Stablecoin Cash Equivalent Test (FASB Proposed 2026-08)

> Exports a decision via MCP `check_stablecoin_cash_equiv` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/797-stablecoin-cash-equivalent-test.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/797-stablecoin-cash-equivalent-test.md) — §10.2.
