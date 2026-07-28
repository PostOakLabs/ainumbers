---
type: DecisionTool
title: "SCO60 Crypto-Asset Exposure Classifier"
description: "Classifies a crypto-asset position into Basel SCO60 Group 1a, 1b, 2a, or 2b (BCBS d545 Prudential treatment of cryptoasset exposures), applies the Group 1 infrastructure-risk capital add-on, and checks the Group 2 exposure limit of 1% of Tier 1 capital. National implementation timelines vary; never asserts jurisdictional adoption. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.html
tags: ["compliance_mandate", "wave-50", "mcp:classify_sco60_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-281-sco60-crypto-asset-exposure-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.html
    title: "public tool page"
---

# SCO60 Crypto-Asset Exposure Classifier

> Exports a decision via MCP `classify_sco60_exposure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
