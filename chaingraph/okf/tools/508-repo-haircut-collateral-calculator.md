---
type: DecisionTool
title: "On-Chain Repo Haircut Calculator"
description: "Compute repo haircut with Canton 24/7 collateral valuation versus legacy weekend gap. Applies Basel CRE22 supervisory haircuts and BCBS d349 SFT minimum haircut floors. GMRA/SFTR reporting output."
resource: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html
tags: ["collateral_mandate", "wave-8", "mcp:calculate_repo_haircut", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/508-repo-haircut-collateral-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html
    title: "public tool page"
---

# On-Chain Repo Haircut Calculator

> Exports a decision via MCP `calculate_repo_haircut` — mandate type `collateral_mandate`.

**Context:** Canton repo mobility chain. CRE22 supervisory haircuts; d349 SFT minimum haircut floors; 24/7 valuation advantage.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md), [On-Chain Cash-Leg Finality Checker](./506-onchain-cash-leg-finality-checker.md)

## Attested computation

[executor + attester binding](../computations/508-repo-haircut-collateral-calculator.md) — §10.2.
