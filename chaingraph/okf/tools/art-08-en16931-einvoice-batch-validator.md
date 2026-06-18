---
type: DecisionTool
title: "EN 16931 / Factur-X E-Invoicing Batch Validator"
description: "Batch validation of e-invoices against EN 16931 mandatory fields, VAT logic, and country profiles. France mandatory September 2026; SMEs September 2027."
resource: https://ainumbers.co/chaingraph/art-08-en16931-einvoice-batch-validator.html
tags: ["compliance_mandate", "wave-2", "mcp:validate_einvoice_batch"]
timestamp: 2026-06-18T15:15:44.978Z
---

# EN 16931 / Factur-X E-Invoicing Batch Validator

> Exports a decision via MCP `validate_einvoice_batch` — mandate type `compliance_mandate`.

**Deadline:** 2026-09 — France large/medium mandatory September 2026; EU ViDA

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-08-en16931-einvoice-batch-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ISO 20022 Structured-Address Migration Batch Verifier](./rca-03-iso20022-address-migration-verifier.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
