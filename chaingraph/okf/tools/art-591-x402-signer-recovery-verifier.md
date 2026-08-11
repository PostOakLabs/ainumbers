---
type: DecisionTool
title: "x402 Signer Recovery Verifier"
description: "Recovers the ECDSA signer address from a caller-supplied EIP-712 digest (the sibling art-590-x402-eip712-digest-recomputer's output) and a signature in (r,s,v) or (r,s,yParity) form, normalizing the recovery-id across the raw bit, legacy Ethereum v (27/28), and EIP-155 v (chainId*2+35/36) conventions. Reports the recovered address as a fact plus a separate boolean comparison against any caller-claimed from address. Signature recovery comes from the already-vendored, pinned noble-curves bundle (no new vendoring); malformed or invalid-recovery-id signatures produce a clean refusal finding, never a thrown exception. Proves that an address signed the exact digest supplied; does not prove settlement, spend, or that funds moved. Zero network calls; never a facilitator, proxy, or settlement relay."
resource: https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.html
tags: ["compliance_control", "wave-99", "mcp:verify_x402_signer_recovery"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-591-x402-signer-recovery-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.html
    title: "public tool page"
---

# x402 Signer Recovery Verifier

> Exports a decision via MCP `verify_x402_signer_recovery` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-591-x402-signer-recovery-verifier.md) — §10.2.
