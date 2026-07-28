---
type: DecisionTool
title: "Multi-Currency PvP Validator"
description: "Validate atomic cross-currency PvP settlement on Canton to eliminate Herstatt risk in FX and multi-currency repo. Covers PFMI P12 PvP model compliance, FX netting, and repo pre-funding windows."
resource: https://ainumbers.co/tools/511-multi-currency-pvp-validator.html
tags: ["settlement_mandate", "wave-8", "mcp:validate_pvp_settlement", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/511-multi-currency-pvp-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/511-multi-currency-pvp-validator.html
    title: "public tool page"
---

# Multi-Currency PvP Validator

> Exports a decision via MCP `validate_pvp_settlement` — mandate type `settlement_mandate`.

**Context:** multi-currency PvP. PFMI P12; BIS/FSB PvP guidance; BCBS CRE70 Herstatt risk elimination.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/511-multi-currency-pvp-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Canton DvP Atomicity Validator](./507-canton-dvp-atomicity-validator.md), [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md)

**Feeds:** _terminal node_
