---
type: DecisionTool
title: "Canton Tokenization Readiness Diagnostic"
description: "12-question weighted diagnostic across six readiness domains for Canton Network pilots: settlement ops, custody, cash-leg, privacy, AML/KYA, and capital. Routes to the correct workflow chain based on gap scores."
resource: https://ainumbers.co/tools/503-canton-tokenization-readiness-diagnostic.html
tags: ["readiness_diagnostic", "wave-8", "mcp:diagnose_canton_readiness", "iso20022:party-identification"]
timestamp: 2026-07-14
---

# Canton Tokenization Readiness Diagnostic

> Exports a decision via MCP `diagnose_canton_readiness` — mandate type `readiness_diagnostic`.

**Context:** Canton/TMI. Root D0 diagnostic for the Canton Capital Efficiency chain.

**Semantic profile:** `iso20022:party-identification` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/503-canton-tokenization-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Settlement-Risk Capital Efficiency Optimizer](./504-settlement-risk-capital-optimizer.md)
