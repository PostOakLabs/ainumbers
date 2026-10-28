---
type: DecisionTool
title: "PSP Dispute Reason Crosswalk"
description: "Dispute reason-code crosswalk across PayPal, Stripe, Adyen and Square (static and credential-free: the mapping tables ship with the kernel, so no live PSP API is called). Inputs: either {psp, reason} (one PSP's own dispute-reason value in that PSP's exact enum spelling: PayPal dispute_reason schema v1.12 including the British UNAUTHORISED; Stripe reason; Adyen Visa scheme reason codes, the one scheme table the Adyen snapshot reproduces; Square DisputeReason) or {network_code: {network, code}} for a card-network reason code where the snapshots publish a mapping (Visa, Mastercard). Outputs: the equivalent reason values at the other three PSPs with a per-cell match grade (exact / partial / none), each cell justified by the snapshot clause ids and verbatim quotes that support it, plus the evidence categories per PSP where a snapshot states them, the network codes where any snapshot states a mapping, the concept and concept label, the per-PSP match, cited clauses, domain errors and refusal_reason. Every mapping cell cites a clause from the four primary-text snapshots: research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md (S1-S9, fetch 2026-10-25T03Z), stripe-disputes-2026-10 (S1-S6, fetch 2026-10-26T12Z), adyen-disputes-2026-10 (A1-A6, fetch 2026-10-26T12Z) and square-disputes-2026-10 (Q1-Q5, fetch 2026-10-26T12Z). A mapping no snapshot supports is none, never inferred: a none cell carries no value and no invented clause, and a snapshot-stated absence (e.g. Stripe S5's Visa row mapping Unrecognized to None; Square publishing no network mapping) is cited as stated, not guessed. Unknown PSP, unknown reason, non-string reason, both-or-neither input shape and unknown network or network code are refused by name. Singleton reasons no other PSP supports cross to none rather than inferring an equivalent. Shape follows the estate's crosswalk exemplar art-133. Zero network, zero PII, no credentials."
resource: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html
tags: ["compliance_mandate", "wave-136", "mcp:crosswalk_psp_dispute_reasons"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-777-psp-dispute-reason-crosswalk.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html
    title: "public tool page"
---

# PSP Dispute Reason Crosswalk

> Exports a decision via MCP `crosswalk_psp_dispute_reasons` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline: this node is a static dispute reason-code crosswalk, not a dated obligation. Per-PSP dispute response deadlines are art-776's scope, not this node's.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-777-psp-dispute-reason-crosswalk.md) — §10.2.
