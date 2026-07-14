---
type: DecisionTool
title: "Wolfsberg Payment Transparency & LEI Binding Linter"
description: "Full ISO 17442 LEI check-digit validation via ISO 7064 Mod 97-10 for originator and beneficiary LEIs in pacs.008. Also scores Wolfsberg Payment Transparency Standards across six fields (originator name, account, LEI; beneficiary name, account, LEI) and assigns a transparency tier (HIGH, MEDIUM, LOW). LEIs are public GLEIF registry data -- no PII involved. For format-only LEI checks within broader party completeness validation use validate_pacs008_party_completeness (art-242)."
resource: https://ainumbers.co/chaingraph/art-246-lei-payment-binding-linter.html
tags: ["compliance_mandate", "wave-41", "mcp:lint_lei_payment_binding"]
timestamp: 2026-07-14
---

# Wolfsberg Payment Transparency & LEI Binding Linter

> Exports a decision via MCP `lint_lei_payment_binding` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-246-lei-payment-binding-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [pacs.008 Party Completeness Validator](./art-242-pacs008-party-completeness-validator.md)

**Feeds:** _terminal node_
