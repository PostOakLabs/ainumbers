---
type: DecisionTool
title: "Cross-Network Atomic Settlement Validator"
description: "Validates atomic settlement across two or more networks: cash leg final on the money ledger, asset leg delivered on the asset ledger, FX leg PvP where present. Detects finality mismatch across legs, non-atomic cross-network risk, and PvP gaps per CPMI-IOSCO PFMI Principles 8 + 12. Models BIS Agorá unifying-ledger, ECB Pontes TARGET-link, and DTCC Collateral AppChain coordination patterns. Distinct from Canton single-network DvP."
resource: https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.html
tags: ["settlement_mandate", "wave-13", "mcp:validate_cross_network_settlement"]
timestamp: 2026-07-14
---

# Cross-Network Atomic Settlement Validator

> Exports a decision via MCP `validate_cross_network_settlement` — mandate type `settlement_mandate`.

**Deadline:** 2026-Q3 — ECB Pontes TARGET-link pilot end-Q3 2026; DTCC Collateral AppChain full production Oct 2026. Verify cross-network coordination patterns against current primary sources.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Wholesale Tokenized Settlement Fit Diagnostic](./art-56-tokenized-settlement-fit-diagnostic.md), [Settlement-Asset & Legal-Finality Classifier](./art-59-settlement-asset-finality-classifier.md)

**Feeds:** [Canton DvP Atomicity Validator](./507-canton-dvp-atomicity-validator.md), [Multi-Currency PvP Validator](./511-multi-currency-pvp-validator.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
