---
type: DecisionTool
title: "BoLD Challenge-Window Finality Classifier"
description: "Classifies a settlement-finality claim on Robinhood Chain, an Arbitrum Orbit dedicated blockchain using BoLD interactive fraud proofs, into soft, posted, challengeable, or final. Onchain settlement inside the roughly week-long BoLD challenge window is optimistic, not final, and a claim asserting final finality inside that window is flagged as overstated. Downstream of classify_settlement_asset_finality in the finality-classification chain; follows the check_linea_l2_finality_window shape as a precedent only, since the proof system differs. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html
tags: ["settlement_finality_mandate", "wave-56", "mcp:classify_bold_challenge_finality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-321-rhc-bold-finality-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html
    title: "public tool page"
---

# BoLD Challenge-Window Finality Classifier

> Exports a decision via MCP `classify_bold_challenge_finality` — mandate type `settlement_finality_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Settlement-Asset & Legal-Finality Classifier](./art-59-settlement-asset-finality-classifier.md)

**Feeds:** _terminal node_
