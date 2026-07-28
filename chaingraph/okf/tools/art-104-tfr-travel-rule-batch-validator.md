---
type: DecisionTool
title: "TFR Travel-Rule Batch Validator"
description: "Validates originator/beneficiary field completeness on synthetic/hashed transfer batches (self-/cross-CASP + unhosted-wallet branches) per TFR recast Reg. (EU) 2023/1113. Batch conformance + Merkle root. No real PII."
resource: https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.html
tags: ["compliance_mandate", "wave-20", "mcp:validate_tfr_travel_rule_batch"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-104-tfr-travel-rule-batch-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.html
    title: "public tool page"
---

# TFR Travel-Rule Batch Validator

> Exports a decision via MCP `validate_tfr_travel_rule_batch` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-104-tfr-travel-rule-batch-validator.md) — §10.2.
