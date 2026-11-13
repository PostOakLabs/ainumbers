---
type: DecisionTool
title: "Liquid-Staking Share Rate Reconciler"
description: "Recomputes the share rate of a rebasing liquid-staking token from caller-declared protocol state: internal ether (the rate numerator), internal shares (the rate denominator) and external shares. Share-to-ether and ether-to-share conversions use the internal figures and round down; wrap and unwrap amounts are reported as share conversions with a round-trip loss and its exact bound (zero up to the ceiling of internal ether over internal shares). Between consecutive declared snapshots it reports the holder balance change, including negative rebases, and the dilution from a declared count of shares minted as fees. Total shares, external ether and total pooled ether are reported as disclosure only and never enter a conversion; an optional declared total is cross-checked and any residual is reported, not refused. Operands above the 128-bit bounds, zero rate terms and zero wrap or unwrap amounts are refused. All arithmetic is exact integer math with no floating point. This node never reads any chain: it cannot know whether the declared values match a deployed token, whether a snapshot came from a real oracle report, or how external shares were minted. Fee rates, withdrawal finalization and mintable-external capacity are not modeled."
resource: https://ainumbers.co/chaingraph/808-lst-share-rate-reconciler.html
tags: ["compliance_control", "wave-142", "mcp:reconcile_lst_share_rate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/808-lst-share-rate-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/808-lst-share-rate-reconciler.html
    title: "public tool page"
---

# Liquid-Staking Share Rate Reconciler

> Exports a decision via MCP `reconcile_lst_share_rate` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/808-lst-share-rate-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/808-lst-share-rate-reconciler.md) — §10.2.
