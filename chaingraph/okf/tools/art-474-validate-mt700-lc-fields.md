---
type: DecisionTool
title: "MT700 LC Field Validator"
description: "Validates SWIFT MT700 Documentary Credit field-format and date-logic conformance against UCP 600 / MT700 mandatory-field rules: DC number, form of credit, issue/expiry/shipment dates, currency and amount, availability terms, shipment terms, goods description, documents required, presentation period, and party fields. Returns a weighted compliance score, field-by-field findings, and article citations. Provable node counterpart to tools/420-mt700-lc-field-validator.html; the tool page's Presented Documents discrepancy check (UCP 600 R01-R14) stays browser-only."
resource: https://ainumbers.co/chaingraph/art-474-validate-mt700-lc-fields.html
tags: ["compliance_mandate", "wave-65", "mcp:validate_mt700_lc_fields"]
timestamp: 2026-07-14
---

# MT700 LC Field Validator

> Exports a decision via MCP `validate_mt700_lc_fields` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-474-validate-mt700-lc-fields.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
