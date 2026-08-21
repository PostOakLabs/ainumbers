---
type: DecisionTool
title: "Loan Servicing Waterfall Recompute"
description: "Independently recomputes how a single borrower's single loan payment applies across escrow, fee, interest and principal buckets under the note's own caller-declared bucket application order, then diffs the recomputed per-bucket breakdown against the core's actual applied amounts. The application order, pre-payment bucket balances and payment amount are all caller-declared contract terms -- this node asserts no universal statutory application order and infers none. Verdict is MATCHES, DIVERGES (with per-bucket deltas), or INDETERMINATE whenever a required input -- a declared bucket's balance, or the core's applied breakdown to diff against -- is absent. Recompute and receipt only; this is not a claim that either side's figure is the legally correct one."
resource: https://ainumbers.co/tools/664-loan-servicing-waterfall-recompute.html
tags: ["compliance_control", "wave-109", "mcp:compute_loan_servicing_waterfall_recompute"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-664-loan-servicing-waterfall-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/664-loan-servicing-waterfall-recompute.html
    title: "public tool page"
---

# Loan Servicing Waterfall Recompute

> Exports a decision via MCP `compute_loan_servicing_waterfall_recompute` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/664-loan-servicing-waterfall-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-664-loan-servicing-waterfall-recompute.md) — §10.2.
