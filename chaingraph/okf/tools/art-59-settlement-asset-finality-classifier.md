---
type: DecisionTool
title: "Settlement-Asset & Legal-Finality Classifier"
description: "Classifies the settlement asset (CBM token / tokenized commercial bank deposit / regulated stablecoin / e-money token) against its legal-finality regime (EU SFD 98/26/EC / CPMI-IOSCO PFMI Principle 8 / UCC Article 12 control) -> finality tier 1-4 + singleness-of-money verdict. Gates ART-58 cross-network atomicity check."
resource: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html
tags: ["compliance_mandate", "wave-13", "mcp:classify_settlement_asset_finality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-59-settlement-asset-finality-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html
    title: "public tool page"
---

# Settlement-Asset & Legal-Finality Classifier

> Exports a decision via MCP `classify_settlement_asset_finality` — mandate type `compliance_mandate`.

**Deadline:** 2026-Q3 — ECB Pontes pilot end-Q3 2026; DTCC Collateral AppChain production Oct 2026. Verify SFD/PFMI designations against current regulatory status before that date.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Wholesale Tokenized Settlement Fit Diagnostic](./art-56-tokenized-settlement-fit-diagnostic.md)

**Feeds:** [Cross-Network Atomic Settlement Validator](./art-58-cross-network-settlement-validator.md), [On-Chain Cash-Leg Finality Checker](./506-onchain-cash-leg-finality-checker.md), [Digital Asset Regulatory Classifier](./510-digital-asset-regulatory-classifier.md)
