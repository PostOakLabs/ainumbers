---
type: DecisionTool
title: "EMIR UPI Validator"
description: "Validate EMIR Refit UPI format (ISO 4914, 12-character alphanumeric via ANNA Derivatives Service Bureau) and product classification consistency: asset class must be a supported EMIR class (IR/CR/EQ/CO/FX) and instrument type must be present. Terminal node of the emir-trade-report-validation chain; exports field-level validity verdict with execution_hash."
resource: https://ainumbers.co/chaingraph/art-155-emir-upi-validator.html
tags: ["compliance_mandate", "wave-28", "mcp:validate_emir_upi"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-155-emir-upi-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-155-emir-upi-validator.html
    title: "public tool page"
---

# EMIR UPI Validator

> Exports a decision via MCP `validate_emir_upi` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-155-emir-upi-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EMIR UTI Completeness Checker](./art-154-emir-uti-completeness-checker.md)

**Feeds:** _terminal node_
