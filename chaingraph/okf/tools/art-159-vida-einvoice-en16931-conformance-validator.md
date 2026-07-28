---
type: DecisionTool
title: "ViDA EN 16931 E-Invoice Conformance Validator"
description: "Validate a structured e-invoice against EN 16931-1:2026 mandatory field requirements for ViDA Digital Reporting Requirements. Checks invoice_number, invoice_date, currency_code, seller_name, buyer_name, seller_vat_id, syntax_id, vat_breakdown, and total_with_vat. Returns conformance verdict and missing-field list. Root node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516, mandatory 2030-07-01."
resource: https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.html
tags: ["compliance_mandate", "wave-29", "mcp:validate_vida_einvoice_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-159-vida-einvoice-en16931-conformance-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.html
    title: "public tool page"
---

# ViDA EN 16931 E-Invoice Conformance Validator

> Exports a decision via MCP `validate_vida_einvoice_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ViDA DRR Transaction Reporter](./art-160-vida-drr-transaction-reporter.md)
