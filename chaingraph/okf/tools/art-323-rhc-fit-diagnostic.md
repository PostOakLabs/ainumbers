---
type: DecisionTool
title: "Robinhood Chain Fit Diagnostic"
description: "12-question A-F diagnostic grading a firm's Robinhood Chain adoption fit across four paths: stock-token application, collateral/lending venue, index/basket product, and agent-settlement automation. Routes to the reconciliation, regime-mapping, valuation-lint, collateral-haircut, BoLD-finality, and AP-redemption-stress workflows. Deliberately does not reuse the MiCA/GENIUS question set from the Tempo and Arc diagnostics, since Robinhood Chain stock tokens sit in the opposite regulatory carve-out. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-56", "mcp:run_robinhood_chain_fit_diagnostic"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-323-rhc-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html
    title: "public tool page"
---

# Robinhood Chain Fit Diagnostic

> Exports a decision via MCP `run_robinhood_chain_fit_diagnostic` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ERC-8056 Multiplier Reconciler](./art-317-rhc-multiplier-reconciler.md), [Financial-Instrument Regime Mapper](./art-318-rhc-regime-mapper.md), [Valuation Double-Count / Decimal Linter](./art-319-rhc-valuation-linter.md), [Halt + Staleness Collateral Haircut](./art-320-rhc-collateral-haircut.md), [BoLD Challenge-Window Finality Classifier](./art-321-rhc-bold-finality-classifier.md), [AP Concentration + Redemption-Path Stress](./art-322-rhc-ap-redemption-stress.md)

## Attested computation

[executor + attester binding](../computations/art-323-rhc-fit-diagnostic.md) — §10.2.
