---
type: DecisionTool
title: "V4 Hook Permission Reconciler"
description: "Decodes a Uniswap v4 hook address's 14 permission bits (the low 14 bits of the address, per v4-core at the pinned commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585, src/libraries/Hooks.sol) against a caller-declared callback set, and reconciles the two: each of the 14 flags (beforeInitialize through afterRemoveLiquidityReturnDelta) is reported MATCH, DECLARED_NOT_SET (the callback will never fire) or SET_NOT_DECLARED (the PoolManager calls an undisclosed function), with the mismatch count equal to the popcount of declared XOR actual. The node also replicates v4-core's isValidHookAddress validity rule: each return-delta flag requires its base flag, the zero address must not carry a dynamic fee, and a non-zero hook must have at least one flag set or a dynamic pool fee (pool_fee 0x800000), reporting valid_hook_address plus the failing rule. declared_permissions is accepted flat (all 14 booleans required; a missing key is a refusal, never a default) or in the Uniswap hooklist entry shape { hook.address, flags, properties.dynamicFee }; when a registry dynamicFee declaration is supplied it is reconciled with the caller's pool_fee (dynamic iff pool_fee equals 0x800000 exactly, per LPFeeLibrary.sol isDynamicFee; any other value is a static fee) and the declaration_source is emitted. standards_basis names the pinned v4-core commit. Zero network: the node never reads a chain and decodes only what the caller supplies; it states no opinion on whether a hook is safe or compliant."
resource: https://ainumbers.co/chaingraph/art-708-v4-hook-permission-reconciler.html
tags: ["compliance_control", "wave-127", "mcp:reconcile_v4_hook_permissions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-708-v4-hook-permission-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-708-v4-hook-permission-reconciler.html
    title: "public tool page"
---

# V4 Hook Permission Reconciler

> Exports a decision via MCP `reconcile_v4_hook_permissions` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-708-v4-hook-permission-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-708-v4-hook-permission-reconciler.md) — §10.2.
