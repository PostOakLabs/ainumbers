---
type: DecisionTool
title: "CSDR Penalty Recompute (Caller Reference Price)"
description: "Per-ISIN/day CSDR cash-penalty recompute over a caller-declared open-fails set: selects the RTS asset-class/penalty-type daily rate (CSDR-RTS-2025-10, ESMA Final Report 13 Oct 2025), applies fail duration to a caller-supplied reference_price and quantity, credits partial settlement proportionally, and sums forward penalty exposure across the fails set. Fixes art-78-csdr-penalty-calculator's reachability defect -- art-78 priced off notional with no shipped pack able to feed it a differing reference_price; this node's schema instead requires a caller-supplied reference_price per fail. art-78 keeps its own identity and chain wiring unchanged. Supports an optional OCG Standard section 25 ocg-private-input@1 declaration (sha256-salted@1) for the ISIN and counterparty_id per fail, since a small ISIN/counterparty universe is enumerable by table lookup."
resource: https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.html
tags: ["compliance_mandate", "wave-85", "mcp:recompute_csdr_penalty"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-543-csdr-penalty-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.html
    title: "public tool page"
---

# CSDR Penalty Recompute (Caller Reference Price)

> Exports a decision via MCP `recompute_csdr_penalty` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-543-csdr-penalty-recompute.md) — §10.2.
