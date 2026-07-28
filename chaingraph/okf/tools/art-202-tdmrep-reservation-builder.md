---
type: DecisionTool
title: "TDMRep AI Training Reservation Builder"
description: "Builds W3C TDMRep AI-training rights reservation records from a reservation flag, optional location scope pattern, optional policy URL, and optional ISCC content reference. Outputs a tdmrep.json rule array, HTTP Content-Usage header equivalents, and HTML meta-tag equivalents per the W3C TDM Reservation Protocol and IETF AIPREF draft."
resource: https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.html
tags: ["compliance_mandate", "wave-35", "mcp:build_tdm_reservation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-202-tdmrep-reservation-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.html
    title: "public tool page"
---

# TDMRep AI Training Reservation Builder

> Exports a decision via MCP `build_tdm_reservation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISCC Content Code Generator](./art-201-iscc-content-code-generator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-202-tdmrep-reservation-builder.md) — §10.2.
