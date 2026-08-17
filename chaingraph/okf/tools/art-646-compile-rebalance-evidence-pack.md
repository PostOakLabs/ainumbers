---
type: DecisionTool
title: "Compile Rebalance Evidence Pack"
description: "Packages one rebalance event, the current period's constituent set and weight set, plus the prior period's for diffing, into a regulator-shaped bundle: what changed (additions/removals/weight deltas), citing the underlying art-557/art-645 receipts rather than recomputing them. This is the vertical's answer to a BMR administrator's-oversight-function record and a SEBI benchmark-administrator disclosure pack. HARD FENCE: this bundle CITES the referenced receipts (execution_hash + tool_id); it does not re-run or independently verify the weighting arithmetic against a third-party feed, and it makes no claim of BMR/SEBI compliance, informative citation only. The current/prior constituent and weight rows used for the diff are caller-supplied and asserted (zero-egress), same fence as art-557/art-645. Third entry of the Financial Index/Benchmark Administrator Lineage family. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 13(1) and SEBI (Index Providers) Regulations, 2024 Reg 19(2)/19(3) citations informative only."
resource: https://ainumbers.co/chaingraph/art-646-compile-rebalance-evidence-pack.html
tags: ["compliance_mandate", "wave-105", "mcp:compile_rebalance_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-646-compile-rebalance-evidence-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-646-compile-rebalance-evidence-pack.html
    title: "public tool page"
---

# Compile Rebalance Evidence Pack

> Exports a decision via MCP `compile_rebalance_evidence_pack` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-646-compile-rebalance-evidence-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-646-compile-rebalance-evidence-pack.md) — §10.2.
