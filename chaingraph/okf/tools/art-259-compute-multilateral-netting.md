---
type: DecisionTool
title: "Multilateral Cash Netting"
description: "Computes N-entity corporate cash netting: gross inter-company positions to net positions to minimum settlement legs using the BIS CPMI greedy matching algorithm (Net Settlement Framework 2012). Reports wire-count savings and netting_efficiency_pct. Corporate cash netting only -- NOT estimate_ficc_margin_netting (FICC US-Treasury clearing). Netting statement suitable for anchor_batch Merkle-leaf receipts. ZERO PII: aggregate entity balances only, no account-holder identifiers."
resource: https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.html
tags: ["analytics_mandate", "wave-44", "mcp:compute_multilateral_netting"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-259-compute-multilateral-netting.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.html
    title: "public tool page"
---

# Multilateral Cash Netting

> Exports a decision via MCP `compute_multilateral_netting` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IHB Interest Allocation](./art-260-allocate-ihb-interest.md)

## Attested computation

[executor + attester binding](../computations/art-259-compute-multilateral-netting.md) — §10.2.
