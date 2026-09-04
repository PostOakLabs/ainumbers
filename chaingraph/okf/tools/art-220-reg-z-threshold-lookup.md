---
type: DecisionTool
title: "Reg Z Threshold Lookup"
description: "Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citations and effective dates. This node exists because agents reliably hallucinate current-year dollar thresholds. Annual refresh cadence with FR citation pinning. Covers CARD Act penalty fees: per 12 CFR 1026.52(b)(1)(ii) as retrieved 2026-09-03 from the eCFR versioner API, an $8 late-payment cap (non-smaller issuers) and $32/$43 for other violations (89 FR 19202); 2021-2023 rows pinned from historical eCFR states."
resource: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
tags: ["compliance_mandate", "wave-37", "mcp:lookup_reg_z_thresholds"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-220-reg-z-threshold-lookup.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
    title: "public tool page"
---

# Reg Z Threshold Lookup

> Exports a decision via MCP `lookup_reg_z_thresholds` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-220-reg-z-threshold-lookup.md) — §10.2.
