---
type: DecisionTool
title: "Canton DvP Atomicity Validator"
description: "Validate atomic DvP settlement on Canton Network against PFMI Principle 12. Generate a counterparty-verifiable settlement-readiness attestation with execution_hash. Eliminates Herstatt risk."
resource: https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.html
tags: ["settlement_mandate", "wave-8", "mcp:validate_canton_dvp_atomicity", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/507-canton-dvp-atomicity-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.html
    title: "public tool page"
---

# Canton DvP Atomicity Validator

> Exports a decision via MCP `validate_canton_dvp_atomicity` — mandate type `settlement_mandate`.

**Context:** Canton DvP chain. PFMI P12 atomic DvP; BCBS CRE70 settlement risk capital relief.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md)

## Attested computation

[executor + attester binding](../computations/507-canton-dvp-atomicity-validator.md) — §10.2.
