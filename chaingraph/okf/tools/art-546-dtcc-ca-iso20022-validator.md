---
type: DecisionTool
title: "DTC Corporate Actions ISO 20022 Message Validator"
description: "Validates the structural message-shape of a single DTC corporate-action event message (notification / election / allocation) against the ISO 20022 field set migrated under DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission -- a DTCC operator mandate, not a regulatory deadline: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). Checks required-field presence per message function, ISO 20022 CAEV event-type code, CUSIP format, DTC participant number, and date formats. Message-shape validation only -- does NOT compute entitlement, dividend, rights, or split amounts; that half is corporate-action entitlement recompute (art-547), which chains from this node's output."
resource: https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.html
tags: ["compliance_mandate", "wave-84", "mcp:validate_dtcc_ca_iso20022_message"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-546-dtcc-ca-iso20022-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.html
    title: "public tool page"
---

# DTC Corporate Actions ISO 20022 Message Validator

> Exports a decision via MCP `validate_dtcc_ca_iso20022_message` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Corporate Action Entitlement Recompute](./art-547-corporate-action-entitlement-recompute.md)

## Attested computation

[executor + attester binding](../computations/art-546-dtcc-ca-iso20022-validator.md) — §10.2.
