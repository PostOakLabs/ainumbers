---
type: DecisionTool
title: "Best-Execution Evidence Pack"
description: "Compiles a caller-declared best-execution monitoring evidence pack: the fill-weighted average price improvement in basis points across declared per-venue fills (2dp half-up), the list of declared negative-improvement venues in declared order, and an overall verdict (REVIEW_ITEM_FLAGGED iff a negative-improvement venue is declared; else WITHIN_POLICY). Declared-fill discipline: per-venue fill counts and improvements are the caller declarations, never observations this kernel makes; no order store, venue connection, or fill observer is read. Basis: Commission Delegated Regulation (EU) 2026/825 on order execution policies (MiFIR review package; replaces discontinued RTS 27/28 published-table reporting with internal evidence), which applies from 12 February 2028 (measured 2026-09-05; derive: OJ publication plus the stated application period per the staging spec note). Absent or invalid venue records fail closed with each offending input named. Zero network, zero storage, zero clock."
resource: https://ainumbers.co/tools/681-best-execution-evidence-pack.html
tags: ["compliance_control", "wave-116", "mcp:compute_best_execution_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-681-best-execution-evidence-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/681-best-execution-evidence-pack.html
    title: "public tool page"
---

# Best-Execution Evidence Pack

> Exports a decision via MCP `compute_best_execution_evidence_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/681-best-execution-evidence-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-681-best-execution-evidence-pack.md) — §10.2.
