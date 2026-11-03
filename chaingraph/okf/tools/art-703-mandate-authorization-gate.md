---
type: DecisionTool
title: "Mandate Authorization Gate"
description: "Automated payment approval gate with no human step, in two modes. In authorize mode a caller-supplied mandate, caller-supplied budget and rail state, and a proposed payment request go through a fixed ten-rule order: amount validity, mandate revocation, not-yet-valid, expired (the exact expiry boundary included), currency mismatch, payer mismatch (when the mandate names a payer), payee coverage (mandate payee and verified-payee list), the per-payment cap, the budget, and the rail allowlist. Every failing rule is listed with a named reason and the first failure is the primary reason. On no failure the node issues a one-use authorization bound to the exact request digest and mandate digest, with a validity window that starts at as_of and closes at as_of plus a ttl of 1 to 900 seconds clipped to the mandate's own expiry; the authorization_id is the digest of the operation, both digests and the window, and doubles as the rail's single-use nonce as 0x-prefixed 32-byte hex. In verify_commit mode the node recomputes the authorization_id from the presented authorization's own fields, re-digests the committed request, and checks the window, refusing with AUTHORIZATION_ID_MISMATCH, DIGEST_MISMATCH, OPERATION_MISMATCH, NOT_YET_VALID or AUTHORIZATION_EXPIRED. Amounts are integers in minor units; the mandate cap is a decimal major-unit string converted by pure integer string arithmetic through a curated minor-unit exponent table, refusing an unknown currency and refusing over-precise caps instead of rounding, with no float anywhere. Timestamps are UTC strings only, parsed to integer epoch seconds, no Date object. Declared exclusions: single use is enforced by the payment rail through the nonce, not by this stateless node; budget state is caller-supplied (spent_minor); the mandate signature is not verified here, that is art-01 or art-31's job; an absent rail allowlist allows no rail (fail closed). Consumes the canonical mandate pivot of art-476, so mandates declared under any of the protocols art-476 translates reach this gate through that one edge."
resource: https://ainumbers.co/chaingraph/art-703-mandate-authorization-gate.html
tags: ["payment_mandate", "wave-123", "mcp:authorize_payment_against_mandate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-703-mandate-authorization-gate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-703-mandate-authorization-gate.html
    title: "public tool page"
---

# Mandate Authorization Gate

> Exports a decision via MCP `authorize_payment_against_mandate` — mandate type `payment_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-703-mandate-authorization-gate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Payment Mandate Cross-Protocol Mapper](./art-476-map-agent-payment-mandate.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-703-mandate-authorization-gate.md) — §10.2.
