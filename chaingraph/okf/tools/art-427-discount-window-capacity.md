---
type: DecisionTool
title: "Discount Window Borrowing-Capacity Calculator"
description: "Federal Reserve Discount Window borrowing-capacity calculator: lendable value = sum of pledged collateral positions x published Fed collateral margins (margin table effective date is caller-supplied policy input, not hardcoded) compared against a runnable-liability / uninsured-deposit coverage target. Timely given the pending Discount Window Preparedness Act and the Treasury LCR-recognition push for pre-positioned collateral; no existing vendor tool covers this calculation."
resource: https://ainumbers.co/chaingraph/art-427-discount-window-capacity.html
tags: ["compliance_mandate", "wave-63", "mcp:compute_discount_window_capacity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-427-discount-window-capacity.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-427-discount-window-capacity.html
    title: "public tool page"
---

# Discount Window Borrowing-Capacity Calculator

> Exports a decision via MCP `compute_discount_window_capacity` — mandate type `compliance_mandate`.

**Context:** Discount Window Preparedness Act pending; Treasury LCR-recognition push for pre-positioned DW collateral.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-427-discount-window-capacity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
