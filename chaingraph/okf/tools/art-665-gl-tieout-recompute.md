---
type: DecisionTool
title: "GL Tie-Out Recompute"
description: "Independently recomputes subledger-to-GL tie-out totals from a caller-supplied posted ledger and the caller's own declared product_code -> gl_account_code chart-of-accounts mapping. Single-source mode sums ledger rows per GL account code for a stated period and diffs the recomputed totals against caller-supplied reported trial-balance figures. Diff mode runs the same summation independently over two full ledger sources (for example a legacy-core export and a new-core export covering the same period during a core conversion) and diffs the two recomputed totals against each other, symmetrically, with no side asserted correct -- both figures are labeled source_a / source_b. The chart-of-accounts mapping is a caller-declared input, never chosen or inferred. Verdict is MATCHES, DIVERGES (with per-account-code deltas), or INDETERMINATE whenever a required input -- the mode, a usable ledger, a usable mapping, or a comparison side -- is absent. This is internal-control arithmetic (summation and diff), not an accounting-standards implementation; it cites no external standard. Recompute and receipt only -- never a claim of core-vendor endorsement, a vendor audit, or that either side's figure is legally or operationally correct."
resource: https://ainumbers.co/tools/665-gl-tieout-recompute.html
tags: ["compliance_control", "wave-110", "mcp:compute_gl_tieout_recompute"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-665-gl-tieout-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/665-gl-tieout-recompute.html
    title: "public tool page"
---

# GL Tie-Out Recompute

> Exports a decision via MCP `compute_gl_tieout_recompute` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/665-gl-tieout-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-665-gl-tieout-recompute.md) — §10.2.
