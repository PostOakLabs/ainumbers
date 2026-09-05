---
type: DecisionTool
title: "Intercompany Elimination and Netting Workflow"
description: "Deterministic intercompany elimination and netting arithmetic over caller-declared synthetic entity pairs. For each declared pair the kernel compares the receivable declared by entity a against the payable declared by entity b (both rounded to 2 decimal places, half-up): equal amounts form a matched pair; unequal amounts are listed as a mismatch with their difference. The kernel reports matched and mismatched pair counts, the elimination total (sum of the smaller side of every pair), the unmatched residual (sum of mismatch differences), a full trace, and an overall GAPS_FOUND or ALL_MATCHED verdict. Pure matching arithmetic: not legal advice, not an audit opinion, not a settlement instruction: nothing is posted, netted, or paid anywhere, and no counterparty is contacted. No runtime clock: any as-of dating is a caller-declared input."
resource: https://ainumbers.co/tools/684-intercompany-elimination-netting.html
tags: ["compliance_control", "wave-116", "mcp:compute_intercompany_elimination_netting"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-684-intercompany-elimination-netting.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/684-intercompany-elimination-netting.html
    title: "public tool page"
---

# Intercompany Elimination and Netting Workflow

> Exports a decision via MCP `compute_intercompany_elimination_netting` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/684-intercompany-elimination-netting.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-684-intercompany-elimination-netting.md) — §10.2.
