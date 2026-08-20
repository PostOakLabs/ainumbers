---
type: DecisionTool
title: "Overdraft / NSF Fee Recomputation"
description: "Independently recomputes overdraft (OD) and non-sufficient-funds (NSF) fee events from a caller-supplied posted-transaction ledger and opening balance, applying the caller's own declared posting-order policy (as_supplied, high_to_low_amount, low_to_high_amount, or chronological_by_effective_date) and fee schedule (fee amounts, an optional daily fee-count cap, an optional representment-dedup window, and an optional extended-overdrawn fee tier), then diffs the recomputed fee totals against caller-supplied core-charged fees, aggregated by post_date and fee type. Posting order and every fee-schedule term are caller-declared inputs, never chosen or inferred; the kernel makes no claim about their legality or permissibility. Each ledger item declares whether the bank pays it into a negative balance (an OD event) or returns it unpaid (an NSF event, the conservative default when undeclared). The verdict is MATCHES, DIVERGES, or INDETERMINATE; INDETERMINATE covers an empty ledger, an incomplete fee schedule, or no core-charged fees supplied to compare against, never guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites Regulation DD (12 CFR Part 1030) for the fee-disclosure requirement and Regulation E (12 CFR Part 1005) for the authorization-hold concept behind the APSN pattern, both dated for re-verification against primary text. Stated boundary: this is an independent recompute and receipt, never a core alternative, a vendor audit, or an endorsement claim by any core vendor or platform, and a divergence is an arithmetic finding, never a determination that a fee was charged incorrectly or impermissibly, or is owed back."
resource: https://ainumbers.co/tools/662-odnsf-fee-recompute.html
tags: ["compliance_control", "wave-109", "mcp:compute_odnsf_fee_recompute"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-662-odnsf-fee-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/662-odnsf-fee-recompute.html
    title: "public tool page"
---

# Overdraft / NSF Fee Recomputation

> Exports a decision via MCP `compute_odnsf_fee_recompute` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/662-odnsf-fee-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-662-odnsf-fee-recompute.md) — §10.2.
