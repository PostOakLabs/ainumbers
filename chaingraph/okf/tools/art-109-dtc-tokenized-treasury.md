---
type: DecisionTool
title: "DTC-Custodied Tokenized U.S. Treasury Issuance & DvP"
description: "Validate a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement: DTC-custody linkage, Fed eligibility, ComposerX DAML lifecycle coverage (issuance→corporate-actions→redemption), atomic-DvP readiness, and programmable-collateral-at-issuance. Treasury/DTC-custody-specific; not generic securities lifecycle (512) or FICC clearing economics."
resource: https://ainumbers.co/chaingraph/art-109-dtc-tokenized-treasury.html
tags: ["compliance_mandate", "wave-21", "mcp:validate_dtc_tokenized_treasury"]
timestamp: 2026-07-14
---

# DTC-Custodied Tokenized U.S. Treasury Issuance & DvP

> Exports a decision via MCP `validate_dtc_tokenized_treasury` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-109-dtc-tokenized-treasury.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Asset Regulatory Classifier](./510-digital-asset-regulatory-classifier.md)

**Feeds:** [Canton DvP Atomicity Validator](./507-canton-dvp-atomicity-validator.md)
