---
type: DecisionTool
title: "Securities-Settlement Message Linter (ISO 20022 sese/semt)"
description: "Validates ISO 20022 securities-settlement messages (sese.023 instruction, sese.024 status advice, semt.044 account statement) for schema conformance, mandatory-field presence, ISIN (ISO 6166), and BIC (ISO 9362) validity. Scoped strictly to the sese/semt securities family -- NOT the payments pacs/camt work in cbpr-cutover/rca-03."
resource: https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.html
tags: ["compliance_mandate", "wave-17", "mcp:lint_securities_settlement_message"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-82-securities-settlement-message-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.html
    title: "public tool page"
---

# Securities-Settlement Message Linter (ISO 20022 sese/semt)

> Exports a decision via MCP `lint_securities_settlement_message` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Allocation/Affirmation Conformance Checker](./art-81-allocation-affirmation-conformance.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-82-securities-settlement-message-linter.md) — §10.2.
