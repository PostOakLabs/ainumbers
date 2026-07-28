---
type: DecisionTool
title: "Halt + Staleness Collateral Haircut"
description: "Layers a feed-staleness, sequencer-downtime, and underlying-halt haircut on top of a base repo haircut for Robinhood Chain stock tokens posted as collateral. 46 percent of first-week stock-token transfers settled outside NYSE hours, and the docs name Chainlink staleness checks plus Arbitrum sequencer-uptime validation as required practice. Downstream of check_tokenized_collateral_eligibility and calculate_repo_haircut in the collateral-haircut chain. Returns a liquidation-risk classification: normal, elevated, or blocked. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html
tags: ["collateral_mandate", "wave-56", "mcp:compute_stock_token_collateral_haircut"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-320-rhc-collateral-haircut.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html
    title: "public tool page"
---

# Halt + Staleness Collateral Haircut

> Exports a decision via MCP `compute_stock_token_collateral_haircut` — mandate type `collateral_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md), [On-Chain Repo Haircut Calculator](./508-repo-haircut-collateral-calculator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-320-rhc-collateral-haircut.md) — §10.2.
