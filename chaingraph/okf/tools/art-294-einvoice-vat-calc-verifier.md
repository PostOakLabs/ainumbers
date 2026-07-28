---
type: DecisionTool
title: "E-Invoice VAT Calculation Verifier"
description: "Recompute an e-invoice's line VAT, per-category tax subtotals, tax total, and grand total from its line items under a supplied rounding convention, then compare against the document-asserted amounts. Reverse-charge and zero-rate categories are treated as zero VAT. Verifies arithmetic consistency only, not statutory rate correctness. Middle node of the einvoice-validation-pipeline chain. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.html
tags: ["compliance_mandate", "wave-46", "mcp:verify_einvoice_vat_calc"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-294-einvoice-vat-calc-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.html
    title: "public tool page"
---

# E-Invoice VAT Calculation Verifier

> Exports a decision via MCP `verify_einvoice_vat_calc` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [E-Invoice Format Validator](./art-293-einvoice-format-validator.md)

**Feeds:** [E-Invoice Jurisdiction Mandate Router](./art-295-einvoice-jurisdiction-mandate-router.md)

## Attested computation

[executor + attester binding](../computations/art-294-einvoice-vat-calc-verifier.md) — §10.2.
