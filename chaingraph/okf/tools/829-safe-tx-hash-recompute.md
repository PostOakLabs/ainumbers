---
type: DecisionTool
title: "Safe Transaction Hash Recompute"
description: "Recomputes the hash and decodes known calls. It does not simulate execution and cannot tell you the destination contract is safe. From pasted Safe transaction fields (to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce), the chain id, the Safe address and the Safe version (1.3.0, 1.4.1 or 1.5.0), it recomputes the domain hash, the message hash and the safeTxHash so a signer can compare them with what a hardware wallet displays. Safe versions before 1.3.0 have no chain id in their domain and are refused with an explicit code, never recomputed. The call data is matched against a fixed selector table (ERC-20 and ERC-721 transfer and approval calls, setApprovalForAll, Safe owner, threshold, module, guard and fallback-handler administration, multiSend) and decoded by hand; an unknown selector is reported as not decoded, never as safe, and a multiSend batch is flagged with its nested payload reported as not decoded. Operation 1 (delegatecall), admin calls on the Safe itself and approvals are flagged. Zero network calls; every field is caller-supplied and echoed, never resolved. The Safe repository publishes no fixed hash vectors, so the shipped vectors are self-generated and cross-checked against an independent Keccak implementation; only the two typehash constants are Safe-sourced."
resource: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.html
tags: ["compliance_control", "wave-142", "mcp:recompute_safe_tx_hash"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/829-safe-tx-hash-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.html
    title: "public tool page"
---

# Safe Transaction Hash Recompute

> Exports a decision via MCP `recompute_safe_tx_hash` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/829-safe-tx-hash-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/829-safe-tx-hash-recompute.md) — §10.2.
