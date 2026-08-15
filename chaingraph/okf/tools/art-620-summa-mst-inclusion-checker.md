---
type: DecisionTool
title: "Summa MST Inclusion Checker"
description: "Paste a published Merkle-sum-tree root (hash + sum) and an inclusion proof for one leaf; verifies membership AND local balance-sum-chain consistency entirely offline, client-side. Independently recomputes both the hash chain and the sum chain from the leaf to the root over the pasted proof path -- never trusting the pasted root as an oracle for itself -- and rejects any negative balance or any balance/sum exceeding a declared MAX_BALANCE domain bound anywhere in the path, closing the Maxwell eprint 2022/043 'broken MST' negative-balance-cancellation hazard the same way Summa's own circuit does with a RangeCheckChip, applied here at the application layer instead of inside a ZK circuit. Verify-only: reports leaf inclusion and local range-consistency, never a solvency or reserve-sufficiency claim."
resource: https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.html
tags: ["compliance_mandate", "wave-100", "mcp:verify_summa_mst_inclusion"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-620-summa-mst-inclusion-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.html
    title: "public tool page"
---

# Summa MST Inclusion Checker

> Exports a decision via MCP `verify_summa_mst_inclusion` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-620-summa-mst-inclusion-checker.md) — §10.2.
