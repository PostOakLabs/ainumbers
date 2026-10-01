---
type: DecisionTool
title: "X402 Permit2 Evidence Recomputer"
description: "Recomputes the Permit2 typed-data digest a payer's wallet signs for an x402 payment, for the three single-item message shapes the exact and upto schemes use: a witness transfer that binds the destination, an unwitnessed signature transfer, and an allowance permit. From caller-supplied domain and message fields it derives the domain separator, the struct hash and the digest, deriving each type hash at run time from the type string rather than carrying a transcribed constant, and it reports binding facts against a caller-supplied payment requirement: whether the spender is the pinned x402 proxy, whether the destination bound into the witness matches payTo, whether the token matches the asset, whether the chain matches the network, and whether the amount holds under the scheme rule, which is equality under exact and a ceiling under upto. It reports nonce facts in the right space, keeping the unordered bitmap decomposition of the transfer shapes apart from the sequential counter of the allowance shape, and it reports that an allowance expiration of zero lasts only the current block rather than never expiring. Signature bytes are classified without recovery: length class, whether s sits above half the curve order, the recovery byte form including the raw parity case an on-chain call cannot use, and the counterfactual wrapper marker. Signer recovery itself is handed off to art-591 in that node's exact input shape, and a sponsored approval leg is handed off to art-612 in its. Scope limits: it reads no chain, so nonce spend state, stored allowance, contract code and the current time are caller-declared inputs echoed back, and any absent input reports NOT_EVALUATED rather than a pass. It never originates, relays or submits a payment."
resource: https://ainumbers.co/chaingraph/art-699-x402-permit2-evidence-recomputer.html
tags: ["compliance_control", "wave-119", "mcp:recompute_x402_permit2_digest"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-699-x402-permit2-evidence-recomputer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-699-x402-permit2-evidence-recomputer.html
    title: "public tool page"
---

# X402 Permit2 Evidence Recomputer

> Exports a decision via MCP `recompute_x402_permit2_digest` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-699-x402-permit2-evidence-recomputer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [x402 Signer Recovery Verifier](./art-591-x402-signer-recovery-verifier.md), [ERC-2612 Permit Binding Verifier](./art-612-erc2612-permit-binding-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-699-x402-permit2-evidence-recomputer.md) — §10.2.
