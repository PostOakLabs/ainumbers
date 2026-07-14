---
type: DecisionTool
title: "Tokenized Security Lifecycle Validator"
description: "Validate Daml lifecycle coverage for tokenized securities: issuance, coupon/dividend, corporate actions (splits, mergers), and maturity/redemption events. EU DLT Pilot Regime and MiFID II compliance."
resource: https://ainumbers.co/tools/512-tokenized-security-lifecycle-validator.html
tags: ["compliance_mandate", "wave-8", "mcp:validate_tokenized_security_lifecycle", "iso20022:party-identification"]
timestamp: 2026-07-14
---

# Tokenized Security Lifecycle Validator

> Exports a decision via MCP `validate_tokenized_security_lifecycle` — mandate type `compliance_mandate`.

**Context:** Canton securities issuance chain. Daml lifecycle contracts; EU DLT Pilot Reg. 2022/858; MiFID II.

**Semantic profile:** `iso20022:party-identification` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/512-tokenized-security-lifecycle-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Asset Regulatory Classifier](./510-digital-asset-regulatory-classifier.md)

**Feeds:** _terminal node_
