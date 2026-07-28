---
type: DecisionTool
title: "Tokenized Fund Collateral Validator"
description: "Validate MMF/CNAV/LVNAV/VNAV fund shares as collateral against SEC Rule 2a-7 (post-2023 reforms), EU MMFR, and Basel HQLA exclusion criteria. Canton/Benji tokenized fund collateral assessment."
resource: https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.html
tags: ["collateral_mandate", "wave-8", "mcp:validate_fund_collateral", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/514-tokenized-fund-collateral-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.html
    title: "public tool page"
---

# Tokenized Fund Collateral Validator

> Exports a decision via MCP `validate_fund_collateral` — mandate type `collateral_mandate`.

**Context:** tokenized fund collateral. SEC Rule 2a-7 (post-2023); EU MMFR (EU 2017/1131); Basel HQLA exclusion for fund shares.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md)

**Feeds:** _terminal node_
