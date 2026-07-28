---
type: DecisionTool
title: "EMIR Trade Report Field Validator"
description: "Validate the required-field subset of an EMIR Refit ISO 20022 auth.030 derivative trade report: action type, both counterparty LEIs (20-char ISO 17442), UTI, UPI, notional, currency, effective date, and asset class. Catches missing or malformed fields before submission to the Trade Repository. Feeds UTI completeness checker (art-154)."
resource: https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html
tags: ["compliance_mandate", "wave-28", "mcp:validate_emir_trade_report"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-153-emir-trade-report-field-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html
    title: "public tool page"
---

# EMIR Trade Report Field Validator

> Exports a decision via MCP `validate_emir_trade_report` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [EMIR UTI Completeness Checker](./art-154-emir-uti-completeness-checker.md)

## Attested computation

[executor + attester binding](../computations/art-153-emir-trade-report-field-validator.md) — §10.2.
