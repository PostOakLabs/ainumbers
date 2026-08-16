---
type: DecisionTool
title: "Summa MST Liability Aggregator"
description: "Given up to 16 (id, balance) leaf entries, deterministically builds a SHA-256 Merkle-sum-tree (Summa's node layout: hash=H(id,balance) and sum=balance at each leaf; hash=H(left.sum+right.sum,left.hash,right.hash) and sum=left.sum+right.sum at each middle node, pattern-borrowed from Summa/PSE's proof-of-reserves design, no code vendored) and emits the root commitment plus every leaf's full inclusion proof. Applies Maxwell's (eprint 2022/043 §4.1) mandatory range-check mitigation on the input side: rejects any negative balance or balance exceeding the declared MAX_BALANCE before building the tree. The generator counterpart to the MST inclusion checker (art-620), whose output_payload proofs are consumable directly as that tool's input. Verify-only perimeter: commits to whatever balances it is given, never asserts those balances reflect real reserves."
resource: https://ainumbers.co/chaingraph/art-621-summa-mst-liability-aggregator.html
tags: ["cryptographic_mandate", "wave-100", "mcp:aggregate_summa_mst_liabilities"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-621-summa-mst-liability-aggregator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-621-summa-mst-liability-aggregator.html
    title: "public tool page"
---

# Summa MST Liability Aggregator

> Exports a decision via MCP `aggregate_summa_mst_liabilities` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-621-summa-mst-liability-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Summa MST Inclusion Checker](./art-620-summa-mst-inclusion-checker.md)

## Attested computation

[executor + attester binding](../computations/art-621-summa-mst-liability-aggregator.md) — §10.2.
