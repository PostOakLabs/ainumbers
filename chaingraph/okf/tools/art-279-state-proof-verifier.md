---
type: DecisionTool
title: "State-Proof Verifier"
description: "Verifies an EIP-1186 (eth_getProof) account and storage Merkle-Patricia-Trie proof against a caller-supplied trusted state root using a pure-JavaScript keccak-256 plus RLP decoder and bounded trie walk. Zero-egress, no RPC call. Does not verify that the state root itself belongs to a real canonical block; consensus-proof (light-client header) verification is out of scope. Persona: fund administrator or auditor confirming tokenized-MMF or deposit-token holdings without trusting an RPC provider."
resource: https://ainumbers.co/chaingraph/art-279-state-proof-verifier.html
tags: ["cryptographic_mandate", "wave-49", "mcp:verify_eth_state_proof"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-279-state-proof-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-279-state-proof-verifier.html
    title: "public tool page"
---

# State-Proof Verifier

> Exports a decision via MCP `verify_eth_state_proof` — mandate type `cryptographic_mandate`.

**Context:** No statutory deadline; general-purpose cryptographic verification primitive for the Verify-Rails band.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-279-state-proof-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-279-state-proof-verifier.md) — §10.2.
