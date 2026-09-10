---
type: DecisionTool
title: "Compile NAV-Error Evidence Pack"
description: "Packages one already-produced recompute_fund_nav receipt and one already-produced test_nav_error_materiality receipt into a CSSF Circular 24/856-shaped NAV-error disclosure bundle: what happened, when it was detected, the materiality threshold applied, the affected period, and the correction. The materiality verdict and error/policy figures are echoed verbatim from the cited materiality receipt's own output, never recomputed here. HARD FENCE: this pack cites the referenced receipts by execution_hash and tool_id; it performs zero NAV recomputation and zero materiality-threshold arithmetic of its own, and it makes no claim of CSSF Circular 24/856 compliance, informative citation only. The affected_period, correction and notification fields are caller-supplied and asserted (zero-egress, no CSSF submission of any kind). Fourth entry of the NAV / Fund-Administration Computation Lineage family, alongside recompute_fund_nav, test_nav_error_materiality and compute_fund_expense_ratios."
resource: https://ainumbers.co/chaingraph/art-660-compile-nav-error-evidence-pack.html
tags: ["compliance_mandate", "wave-111", "mcp:compile_nav_error_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-660-compile-nav-error-evidence-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-660-compile-nav-error-evidence-pack.html
    title: "public tool page"
---

# Compile NAV-Error Evidence Pack

> Exports a decision via MCP `compile_nav_error_evidence_pack` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-660-compile-nav-error-evidence-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Recompute Fund NAV](./art-373-recompute-fund-nav.md), [Test NAV-Error Materiality](./art-374-test-nav-error-materiality.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-660-compile-nav-error-evidence-pack.md) — §10.2.
