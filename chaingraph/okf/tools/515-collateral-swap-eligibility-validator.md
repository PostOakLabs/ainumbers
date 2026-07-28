---
type: DecisionTool
title: "Collateral Swap Eligibility Validator"
description: "Validate collateral swaps under GMSLA/GMRA with SFTR Article 15 reuse constraints. HQLA upgrade and downgrade impact analysis. Canton settlement of collateral swap legs."
resource: https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.html
tags: ["collateral_mandate", "wave-8", "mcp:validate_collateral_swap_eligibility", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/515-collateral-swap-eligibility-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.html
    title: "public tool page"
---

# Collateral Swap Eligibility Validator

> Exports a decision via MCP `validate_collateral_swap_eligibility` — mandate type `collateral_mandate`.

**Context:** collateral swap. SFTR Art. 15 reuse constraints; GMSLA 2010; GMRA 2011; BCBS d349 SFT haircut floors.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md), [Canton DvP Atomicity Validator](./507-canton-dvp-atomicity-validator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/515-collateral-swap-eligibility-validator.md) — §10.2.
