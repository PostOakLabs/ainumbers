---
type: DecisionTool
title: "E-Invoice Format Validator"
description: "Conformance-validate a structured e-invoice extract against version-pinned Factur-X, XRechnung, PINT-AE, MyInvois, Peppol BIS 3.0/EN 16931 core (Belgium), or KSeF FA(3) (Poland) format rules: mandatory-field presence, currency/VAT-category codelist membership, line-item cardinality. Returns per-rule findings, missing_fields, and structural_completeness. Root node of the einvoice-validation-pipeline chain. Zero network, zero PII. Not a legal-validity determination."
resource: https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.html
tags: ["compliance_mandate", "wave-46", "mcp:validate_einvoice_format"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-293-einvoice-format-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.html
    title: "public tool page"
---

# E-Invoice Format Validator

> Exports a decision via MCP `validate_einvoice_format` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [E-Invoice VAT Calculation Verifier](./art-294-einvoice-vat-calc-verifier.md)
