---
type: DecisionTool
title: "ViDA DRR Transaction Reporter"
description: "Assess whether an intra-EU B2B transaction falls within the ViDA Digital Reporting Requirements scope and calculate the 10-calendar-day reporting deadline. Checks supply_type (B2B), distinct seller/buyer member states, valid VAT IDs on both sides, and transaction_value completeness. Returns in_scope, reporting_deadline, and completeness gaps. Middle node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516, mandatory 2030-07-01."
resource: https://ainumbers.co/chaingraph/art-160-vida-drr-transaction-reporter.html
tags: ["compliance_mandate", "wave-29", "mcp:assess_vida_drr_reporting_obligation"]
timestamp: 2026-07-14
---

# ViDA DRR Transaction Reporter

> Exports a decision via MCP `assess_vida_drr_reporting_obligation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-160-vida-drr-transaction-reporter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ViDA EN 16931 E-Invoice Conformance Validator](./art-159-vida-einvoice-en16931-conformance-validator.md)

**Feeds:** [ViDA Recapitulative Statement Migration Assessor](./art-161-vida-recapitulative-statement-migration-assessor.md)
