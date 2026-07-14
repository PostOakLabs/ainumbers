---
type: DecisionTool
title: "Reg Z Threshold Lookup"
description: "Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citations and effective dates. This node exists because agents reliably hallucinate current-year dollar thresholds. Annual refresh cadence with FR citation pinning. Covers CARD Act penalty fee note: the CFPB dollar-eight late-fee cap rule was vacated May 2025; prior safe-harbor amounts apply."
resource: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
tags: ["compliance_mandate", "wave-37", "mcp:lookup_reg_z_thresholds"]
timestamp: 2026-07-14
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
