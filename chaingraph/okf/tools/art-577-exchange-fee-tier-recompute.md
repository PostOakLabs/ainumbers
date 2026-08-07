---
type: DecisionTool
title: "Exchange Access-Fee / Maker-Taker Tier Recompute"
description: "Recomputes a monthly exchange maker-taker invoice from a caller-pasted fee schedule: resolves the firm's active tier from its declared prior-period average daily volume (ADV), applies that tier's maker rebate and taker access-fee rate to the declared monthly maker/taker share totals, and diffs the recomputed amount against the claimed invoice within a declared tolerance -- verdict MATCHES, DIVERGES, or INDETERMINATE when no tier qualifies. Separately, independent of which tier is currently active, checks every tier's taker rate in the declared schedule against the Reg NMS Rule 610(c) access-fee cap ($0.001/share for quotations priced at $1.00/share or more, compliance date 2026-11-02) -- verdict CAP_CONFORMANT, CAP_EXCEEDS, or INDETERMINATE when the caller has not declared that the schedule applies to quotes priced at $1.00/share or more. The two checks never gate each other: a schedule can conform to the cap while its invoice diverges, or the reverse. Fee schedules, ADV, and monthly volume are caller-declared inputs; this tool does not source, fetch, or maintain any exchange's published schedule. All rates and money amounts are integer micro-dollars (1 micro = $0.000001) so the arithmetic is exact. Not legal or accounting advice; a DIVERGES or CAP_EXCEEDS verdict is a citable arithmetic finding for the firm and, where relevant, its counsel to evaluate against the exchange's actual published schedule and rule text."
resource: https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.html
tags: ["compliance_control", "wave-97", "mcp:recompute_exchange_fee_tier_invoice"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-577-exchange-fee-tier-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.html
    title: "public tool page"
---

# Exchange Access-Fee / Maker-Taker Tier Recompute

> Exports a decision via MCP `recompute_exchange_fee_tier_invoice` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-577-exchange-fee-tier-recompute.md) — §10.2.
