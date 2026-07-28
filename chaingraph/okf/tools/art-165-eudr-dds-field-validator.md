---
type: DecisionTool
title: "EUDR DDS Field Validator"
description: "Validate the required-field subset of an EUDR Due Diligence Statement (DDS) before TRACES NT filing: operator name, address, EORI, HS code, trade name, quantity, country of production, and geolocation indicator (or micro-operator postal-address exemption). Returns conformant verdict and missing-field list. Root node of the eudr-due-diligence-statement-validation chain. Zero network, zero PII. Reg. EU 2023/1115, mandatory 2026-12-30 (large/medium) / 2027-06-30 (SME)."
resource: https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.html
tags: ["compliance_mandate", "wave-30", "mcp:validate_eudr_due_diligence_statement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-165-eudr-dds-field-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.html
    title: "public tool page"
---

# EUDR DDS Field Validator

> Exports a decision via MCP `validate_eudr_due_diligence_statement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [EUDR Geolocation Plot Validator](./art-166-eudr-geolocation-plot-validator.md)

## Attested computation

[executor + attester binding](../computations/art-165-eudr-dds-field-validator.md) — §10.2.
