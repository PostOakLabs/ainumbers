---
type: DecisionTool
title: "Wholesale Tokenized Settlement Fit Diagnostic"
description: "12-question A-F readiness diagnostic for wholesale tokenized settlement (tokenized deposits, central bank money, regulated stablecoins as settlement assets). Grades settlement-asset choice, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and reconciliation controls; routes to the right wholesale-settlement chain and emits a remediation checklist."
resource: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-13", "mcp:run_tokenized_settlement_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-56-tokenized-settlement-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html
    title: "public tool page"
---

# Wholesale Tokenized Settlement Fit Diagnostic

> Exports a decision via MCP `run_tokenized_settlement_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Deposit-Token Compliance Validator](./art-57-deposit-token-compliance-validator.md), [Cross-Network Atomic Settlement Validator](./art-58-cross-network-settlement-validator.md), [Settlement-Asset & Legal-Finality Classifier](./art-59-settlement-asset-finality-classifier.md), [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md), [Canton Party Allowlist Validator](./509-canton-party-allowlist-validator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
