---
type: DecisionTool
title: "Deposit-Token Compliance Validator"
description: "3-test validator distinguishing a bank-liability deposit token (JPMD/RLN model: at-par-on-demand, on-balance-sheet, allowlisted-wholesale) from a reserve-backed stablecoin or e-money token. Classifies DEPOSIT_TOKEN_CONFIRMED / CBM_TOKEN / EMT_STABLECOIN / DEPOSIT_TOKEN_MISCLASSIFIED. Provides US / UK / EU regime notes and capital accounting guidance. cash/settlement layer."
resource: https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.html
tags: ["compliance_mandate", "wave-13", "mcp:validate_deposit_token_compliance"]
timestamp: 2026-07-14
---

# Deposit-Token Compliance Validator

> Exports a decision via MCP `validate_deposit_token_compliance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Wholesale Tokenized Settlement Fit Diagnostic](./art-56-tokenized-settlement-fit-diagnostic.md)

**Feeds:** [Digital Asset Regulatory Classifier](./510-digital-asset-regulatory-classifier.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [Settlement-Asset & Legal-Finality Classifier](./art-59-settlement-asset-finality-classifier.md)
