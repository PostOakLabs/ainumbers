---
type: DecisionTool
title: "PSP Dispute Reason Crosswalk"
description: "Dispute reason-code crosswalk across PayPal, Stripe, Adyen and Square (PSP-DISPUTE-CROSSWALK-NODE-1; hub proposal PAYPAL-HUB-PROPOSALS-2026-10-24 §10.3(2) as narrowed by the desk 2026-10-25: static and credential-free, no live PSP API). Inputs: either {psp, reason} — one PSP's own dispute-reason value in that PSP's exact enum spelling (PayPal dispute_reason schema v1.12 including the British UNAUTHORISED; Stripe reason; Adyen Visa scheme reason codes, the one scheme table the Adyen snapshot reproduces; Square DisputeReason) — or {network_code: {network, code}} for a card-network reason code where the snapshots publish a mapping (Visa, Mastercard). Outputs: the equivalent reason values at the other three PSPs with a per-cell match grade (exact / partial / none), each cell justified by the snapshot clause ids and verbatim quotes that support it, plus the evidence categories per PSP where a snapshot states them, the network codes where any snapshot states a mapping, the concept and per-PSP match, cited clauses, domain errors and refusal_reason. A mapping no snapshot supports is none, never inferred: a none cell carries no value and no invented clause, and a snapshot-stated absence (e.g. Stripe S5's Visa row mapping Unrecognized to None; Square publishing no network mapping) is cited as stated. Unknown PSP, unknown reason, non-string reason, both-or-neither input shape and unknown network or network code are refused by name. Singleton reasons no other PSP supports cross to none rather than inferring an equivalent. Shape follows the estate's crosswalk exemplar art-133. Zero network, zero PII, no credentials. Clause authority: research/clause-snapshots/{paypal,stripe,adyen,square}-disputes-2026-10/SNAPSHOT.md (row PSP-DISPUTES-PRIMARY-TEXT-1)."
resource: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html
tags: ["compliance_mandate", "wave-136", "mcp:crosswalk_psp_dispute_reasons"]
timestamp: 2026-10-26
generated: { by: "ainumbers/generate-okf", at: "2026-10-26" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-777-psp-dispute-reason-crosswalk.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html
    title: "public tool page"
---

# PSP Dispute Reason Crosswalk

> Exports a decision via MCP `crosswalk_psp_dispute_reasons` — mandate type `compliance_mandate`.

**Context:** Every mapping cell cites a clause from one of the four primary-text snapshots (PayPal S1-S9, Stripe S1-S6, Adyen A1-A6, Square Q1-Q5); cells with no snapshot support are none, never inferred, and snapshot-stated absences are cited as stated.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-777-psp-dispute-reason-crosswalk.md) — §10.2.
