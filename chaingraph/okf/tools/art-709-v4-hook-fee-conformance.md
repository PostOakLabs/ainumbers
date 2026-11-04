---
type: DecisionTool
title: "V4 Hook Fee Conformance"
description: "Recomputes a Uniswap v4 pool's per-swap fee from v4-core's own fee rules at the pinned commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585 (ProtocolFeeLibrary.sol calculateSwapFee: swapFee = protocolFee + lpFee - protocolFee*lpFee/1e6; Pool.sol L307 the protocol-fee-zero pass-through and L310-316 the MAX_SWAP_FEE revert, which applies to exact-out swaps only; LPFeeLibrary.sol the 0x400000 override flag, the 0x800000 dynamic flag and MAX_LP_FEE 1,000,000) and checks each swap's emitted fee against that recomposition: per-swap CONFORMS, OUT_OF_BOUNDS (LP fee outside the declared bounds or over MAX_LP_FEE) or FEE_MISMATCH (the declared fee story does not explain what the pool charged). Validates the packed two-direction protocol fee with isValidProtocolFee (each direction <= 1000 pips), decodes a per-swap LP-fee override by stripping its flag per REMOVE_OVERRIDE_MASK (read only on a dynamic pool, per Hooks.sol beforeSwap; on a static pool it is ignored), enforces the declared total fee cap (swap fee + hook charge), accrues a separately declared hook charge per swap and per recipient in integer floor arithmetic with every remainder reported, and reports LP revenue (amount_in * lpFee / 1e6) side by side, never netted against the hook charge; LP revenue stays LP revenue. An exact-out swap whose composed fee is at or above MAX_SWAP_FEE (where v4 reverts) and a dynamic pool fee (0x800000) without a per-swap override are reported INDETERMINATE rather than guessed; an exact-in swap at that fee is checked like any other. Evidence artifact only: it states no opinion on whether a fee is lawful. Zero network: the node never reads a chain and recomputes only what the caller supplies."
resource: https://ainumbers.co/chaingraph/art-709-v4-hook-fee-conformance.html
tags: ["compliance_control", "wave-128", "mcp:check_v4_hook_fee_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-709-v4-hook-fee-conformance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-709-v4-hook-fee-conformance.html
    title: "public tool page"
---

# V4 Hook Fee Conformance

> Exports a decision via MCP `check_v4_hook_fee_conformance` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-709-v4-hook-fee-conformance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-709-v4-hook-fee-conformance.md) — §10.2.
