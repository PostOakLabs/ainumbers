---
type: DecisionTool
title: "EIP-3009 Agent Spend Gate"
description: "Pre-sign gate for one EIP-3009 (ERC-3009, Draft) transferWithAuthorization or receiveWithAuthorization intent, decided against a caller-declared spend policy and a caller-pasted authorization ledger. Returns exactly one decision: SPEND (within the declared policy), DENY (outside the declared policy: structural authorization defects, signer mismatch, disallowed domain, zero or replayed nonce, invalid or expired validity window, denied or unlisted payee, missing receive-variant contract), OVER_LIMIT (per-transaction cap, window cap or velocity count exceeded, or a same-economics duplicate inside the declared duplicate window), or INDETERMINATE (the policy does not declare enough to decide, for example no per-transaction cap or no window caps, or a domain without verifying_contract or chain_id so the nonce-replay rule cannot run). SPEND requires the nonce-replay rule to have been evaluated. DENY outranks OVER_LIMIT, every failing rule is listed, and the first failing rule in the fixed thirteen-rule order is primary. Rules that cannot run because their policy input is absent are reported as not evaluated rather than guessed. Arithmetic is pure decimal-string uint256 with fixed scan bounds. Counting follows the ruled classes: settled entries count toward window totals from their signed_at, signed-unexpired entries count regardless of age, canceled entries never count in sums but still match the nonce-replay check. Zero network calls, no signature recovery, no digest recomputation, no chain reads: the nonce check runs against the pasted ledger only, and on-chain nonce uniqueness is enforced by the token contract at settlement time. SPEND means within the declared policy; it is not an authorization to move funds and is not proof that funds moved."
resource: https://ainumbers.co/chaingraph/art-816-eip3009-agent-spend-gate.html
tags: ["compliance_control", "wave-142", "mcp:decide_eip3009_agent_spend"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-816-eip3009-agent-spend-gate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-816-eip3009-agent-spend-gate.html
    title: "public tool page"
---

# EIP-3009 Agent Spend Gate

> Exports a decision via MCP `decide_eip3009_agent_spend` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-816-eip3009-agent-spend-gate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-816-eip3009-agent-spend-gate.md) — §10.2.
