---
type: DecisionTool
title: "Margin Call Collateral Mobilizer"
description: "Margin computation branched by instrument type: UMR/BCBS d499 for uncleared derivatives; GMRA/BCBS d349 for repo/SFT. Never mixed. Canton 24/7 collateral mobilisation. VM and IM decomposition."
resource: https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.html
tags: ["collateral_mandate", "wave-8", "mcp:mobilize_margin_collateral", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/513-margin-call-collateral-mobilizer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.html
    title: "public tool page"
---

# Margin Call Collateral Mobilizer

> Exports a decision via MCP `mobilize_margin_collateral` — mandate type `collateral_mandate`.

**Context:** Canton margin call chain. BCBS d499 UMR Phase 6 (Sep 2022 complete); d349 SFT minimum haircut floors; GMRA 2011 annex.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md)

**Feeds:** [On-Chain Cash-Leg Finality Checker](./506-onchain-cash-leg-finality-checker.md)
