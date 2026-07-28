---
type: DecisionTool
title: "E-Invoice Transmission Receipt Builder"
description: "Build a hash-anchored receipt proving a specific e-invoice's transmitted bytes were format-validated and VAT-arithmetic-checked, with the routed mandate attached. Binds to the as-transmitted document digest (and, for hybrid Factur-X, the embedded XML digest separately). Proves validation was run; never certifies tax compliance, legal validity, or clearance-platform acceptance. Carries SPEC.md §27 pre-transmission gate wiring (review_required release gate, emergency_override for a rejected batch) -- schema-only, enforcement pending HA-RETRO-1. Terminal node of the einvoice-validation-pipeline chain. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.html
tags: ["compliance_mandate", "wave-46", "mcp:build_einvoice_transmission_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-296-einvoice-transmission-receipt-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.html
    title: "public tool page"
---

# E-Invoice Transmission Receipt Builder

> Exports a decision via MCP `build_einvoice_transmission_receipt` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [E-Invoice Jurisdiction Mandate Router](./art-295-einvoice-jurisdiction-mandate-router.md)

**Feeds:** _terminal node_
