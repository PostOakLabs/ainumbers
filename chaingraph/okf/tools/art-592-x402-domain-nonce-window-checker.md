---
type: DecisionTool
title: "x402 Domain & Nonce Window Checker"
description: "Checks an EIP-3009 TransferWithAuthorization's domain separation and replay-defense-adjacent fields against caller-supplied expectations. Takes expected_chain_id and expected_verifying_contract as separate, mandatory policy parameters -- distinct from the chainId/verifyingContract actually baked into the signed domain -- and refuses hard (never a soft warning) on either mismatch, the cross-domain replay defect class EIP-712 domain separation exists to prevent. Also checks the validAfter/validBefore window against a caller-supplied now_unix, and the nonce's format (bytes32, non-zero). Accepts an optional caller-supplied nonce_already_used boolean computed against the caller's own on-chain record; this kernel never queries a chain, so on-chain nonce uniqueness is enforced by the token contract at settlement time, not by this verifier. Zero network calls; never a facilitator, proxy, or settlement relay."
resource: https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.html
tags: ["compliance_control", "wave-99", "mcp:check_x402_domain_nonce_window"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-592-x402-domain-nonce-window-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.html
    title: "public tool page"
---

# x402 Domain & Nonce Window Checker

> Exports a decision via MCP `check_x402_domain_nonce_window` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-592-x402-domain-nonce-window-checker.md) — §10.2.
