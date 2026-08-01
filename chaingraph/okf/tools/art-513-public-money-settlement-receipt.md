---
type: DecisionTool
title: "Public-Money Settlement Receipt"
description: "Turns one caller-transcribed payment of public money into settlement evidence an audit authority can check with no access to the operator's database: a single-settlement verdict confirming the obligation was discharged exactly once across all declared rail legs, a ministry/agency attribution verdict against the caller's own revenue-code table, an at-par verdict comparing amount credited to amount collected with every fee itemised and never netted, a finality class echoed per rail from the caller's own declared basis, and a structural exceptions list. Portable to any government payment platform, any treasury-single-account regime, any supreme audit institution -- not built to any one vendor's data model. No rail connector, no switch, no live payment observation: the event is transcribed by the caller, exactly as art-497 transcribes a validator change. Does not classify finality itself -- art-492-classify-settlement-finality and art-59-settlement-asset-finality-classifier already do that; a chain composes them upstream of this node. Zero PII: payer is a class plus an opaque reference, never a name, account number, or address. compliance_control."
resource: https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.html
tags: ["compliance_control", "wave-79", "mcp:build_public_money_settlement_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-513-public-money-settlement-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.html
    title: "public tool page"
---

# Public-Money Settlement Receipt

> Exports a decision via MCP `build_public_money_settlement_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-513-public-money-settlement-receipt.md) — §10.2.
