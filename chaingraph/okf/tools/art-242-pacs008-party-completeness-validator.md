---
type: DecisionTool
title: "pacs.008 Party Completeness Validator"
description: "Validates BIS CPMI d218 harmonised data requirements for a pacs.008 payment instruction: UETR UUIDv4 format, debtor and creditor names, BIC format, LEI format (presence and format; full mod-97 check-digit validation is in lint_lei_payment_binding art-246), and purpose code format. Outputs a CPMI d218 completeness score. Does not validate PostalAddress24 structure (use lint_cbpr_structured_address art-241) or PQC crypto readiness (use check_iso20022_pqc_readiness art-87)."
resource: https://ainumbers.co/chaingraph/art-242-pacs008-party-completeness-validator.html
tags: ["compliance_mandate", "wave-41", "mcp:validate_pacs008_party_completeness"]
timestamp: 2026-07-14
---

# pacs.008 Party Completeness Validator

> Exports a decision via MCP `validate_pacs008_party_completeness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-242-pacs008-party-completeness-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CBPR+ Structured Address Linter](./art-241-cbpr-structured-address-linter.md)

**Feeds:** [Wolfsberg Payment Transparency & LEI Binding Linter](./art-246-lei-payment-binding-linter.md)
