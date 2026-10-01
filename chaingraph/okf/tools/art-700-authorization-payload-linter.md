---
type: DecisionTool
title: "Authorization Payload Linter"
description: "Lints an authorization payload before it is signed, against a signing policy the caller declares. Three declared input modes: EIP-712 typed data as it would be passed to eth_signTypedData_v4, an EIP-7702 authorization tuple, and a bare 32-byte hash about to be signed blind. Classification is string equality of the computed EIP-712 encodeType against the canonical type strings of ERC-2612, the older DAI permit struct, the five recognized Permit2 structs, the three EIP-3009 authorizations, the EntryPoint v0.8 PackedUserOperation, and the OpenZeppelin v5 ForwardRequest; a primaryType whose name matches a known standard but whose encodeType differs is reported as a lookalike, and anything else is reported as unrecognized rather than guessed. Every check carries a stable id and returns FLAGGED, CLEAR or NOT_EVALUATED with the field path, the observed value and the policy value. There are no numeric defaults anywhere: every threshold, allowlist, counterparty set, clock reading and chain fact is a caller-declared input, and a check whose input was not declared reports NOT_EVALUATED and is listed separately, never folded into a CLEAR. policy_conformance is CONFORMS when at least one check was evaluated and every evaluated check is CLEAR, DEVIATES when any check is FLAGGED, and INDETERMINATE when nothing could be evaluated. The display block uses the ERC-7730 field-format vocabulary (tokenAmount in raw base units with caller-declared decimals and ticker, addressName, date in RFC 3339, chainId) so the output composes with clear-signing wallets, and an optional ERC-7730 descriptor is used for a context binding check only, never for rendering. Two facts about the sibling EIP-7702 tuple decoder are reported here rather than changed there: that node does not apply the low-s rule EIP-7702 requires, and it names a zero delegate address as a delegate where EIP-7702 clears the account code instead. Handoffs echo the payload fields in the exact input shapes of the EIP-3009 digest recomputer and the ERC-2612 binding verifier and the EIP-7702 tuple decoder, so post-signature evidence composes. This node performs zero chain reads, recovers no signer, computes no digest, and never originates, relays or submits a transaction. It flags a payload against a declared policy; it does not judge a counterparty, a delegate contract, or an outcome, and it never re-verifies a know-your-agent credential (cite art-565 for that scope). Out of scope in this version and named rather than promised: calldata mode, Seaport orders, Solana, and ERC-1271 signature checking, which needs a chain read."
resource: https://ainumbers.co/chaingraph/art-700-authorization-payload-linter.html
tags: ["payment_policy", "wave-119", "mcp:lint_authorization_payload"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-700-authorization-payload-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-700-authorization-payload-linter.html
    title: "public tool page"
---

# Authorization Payload Linter

> Exports a decision via MCP `lint_authorization_payload` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-700-authorization-payload-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [x402 EIP-712 Digest Recomputer](./art-590-x402-eip712-digest-recomputer.md), [ERC-2612 Permit Binding Verifier](./art-612-erc2612-permit-binding-verifier.md), [EIP-7702 Authorization-Tuple Decoder](./art-614-eip7702-authorization-tuple-decoder.md)

## Attested computation

[executor + attester binding](../computations/art-700-authorization-payload-linter.md) — §10.2.
