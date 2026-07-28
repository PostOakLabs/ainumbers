---
type: DecisionTool
title: "Tokenized Collateral Eligibility Checker"
description: "Classify tokenized assets for DTC/Fed eligibility and Basel HQLA tier (L1/L2A/L2B/non-HQLA). Shared eligibility layer consumed by DvP, repo, margin, and fund workflows. BCBS d349/SCO60."
resource: https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.html
tags: ["collateral_mandate", "wave-8", "mcp:check_tokenized_collateral_eligibility", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/505-tokenized-collateral-eligibility-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.html
    title: "public tool page"
---

# Tokenized Collateral Eligibility Checker

> Exports a decision via MCP `check_tokenized_collateral_eligibility` — mandate type `collateral_mandate`.

**Context:** shared collateral eligibility node. DTC/Fed eligibility + Basel HQLA tier; consumed by T506, T508, T513, T514.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [On-Chain Cash-Leg Finality Checker](./506-onchain-cash-leg-finality-checker.md), [Margin Call Collateral Mobilizer](./513-margin-call-collateral-mobilizer.md), [Tokenized Fund Collateral Validator](./514-tokenized-fund-collateral-validator.md)
