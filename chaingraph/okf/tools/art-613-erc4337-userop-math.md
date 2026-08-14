---
type: DecisionTool
title: "ERC-4337 UserOperation Math"
description: "Recomputes the ERC-4337 account-abstraction userOpHash from a caller-supplied UserOperation, computes the EntryPoint's required prefund from caller-supplied gas limits, and reconciles a declared paymaster charge against a charge recomputed from declared inputs. The EntryPoint version is a mandatory declared parameter and is never inferred: v0.6 hashes a 10-word UserOperation pack while v0.7 hashes an 8-word PackedUserOperation in which verificationGasLimit and callGasLimit pack into accountGasLimits and maxPriorityFeePerGas and maxFeePerGas pack into gasFees, so guessing the version would silently produce a wrong hash. The two versions also differ in the prefund formula: v0.6 multiplies verificationGasLimit by three when a paymaster is present, because that same limit also caps postOp, while v0.7 instead adds the paymaster's own verification and postOp gas limits, parsed from the fixed offsets inside paymasterAndData. Both are supported and an unrecognised version is refused rather than approximated. L1 data and blob fees are never derived: after EIP-4844 they depend on the inclusion-time L1 basefee and blob basefee, which are not derivable offline, so an L1 data fee enters reconciliation only when the caller declares it and its absence is reported as a named gap rather than absorbed into a residual. block.basefee is likewise never fetched, so when the two fee caps differ the effective gas price is reported as null with the reason unless a basefee is declared; when the caps are equal the EntryPoint's own legacy shortcut makes the price derivable with no basefee at all. keccak256 comes from the already-vendored, pinned noble-hashes bundle, copied byte-identically from the sibling x402 digest node, and the ABI encoding scheme is implemented directly as public-spec arithmetic on top of it. Zero network calls and zero chain reads: deposits, stakes, nonce-sequence validity and prior spend are never consulted, and every field is caller-declared and echoed back. This node recomputes and reconciles; it makes no claim that any operation was settled, accepted, included, or final, and no claim about signature validity, since the ERC-4337 spec excludes the signature from the hashed struct. Golden vectors are cross-checked against an independent from-spec Keccak-256 and ABI encoder, itself anchored on externally published Keccak-256 constants, not round-trip self-tests alone."
resource: https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.html
tags: ["payment_policy", "wave-99", "mcp:recompute_erc4337_userop_math"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-613-erc4337-userop-math.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.html
    title: "public tool page"
---

# ERC-4337 UserOperation Math

> Exports a decision via MCP `recompute_erc4337_userop_math` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-613-erc4337-userop-math.md) — §10.2.
