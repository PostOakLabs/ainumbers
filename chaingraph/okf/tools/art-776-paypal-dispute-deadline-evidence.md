---
type: DecisionTool
title: "PayPal Dispute Deadline & Evidence"
description: "PayPal dispute deadline calculator and evidence-bundle producer, the PayPal-side PRODUCER for the existing dispute-evidence chain (hub proposal PAYPAL-HUB-PROPOSALS-2026-10-24 row 9). Inputs: one of the four dispute reasons in the estate's PayPal dispute-evidence map (MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED, UNAUTHORISED, CREDIT_NOT_PROCESSED, reused verbatim from paypal-agent-shop/lib/disputes.js), a lifecycle stage from PayPal's dispute_life_cycle_stage enum (INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION), a funding source, ISO-8601 UTC timestamps (dispute creation, caller-supplied as_of, optional seller_response_due_date passthrough) and the evidence items on hand. Outputs: the seller response deadline from PayPal's stated rules (10 days after dispute creation at the inquiry stage; 20-day inquiry window) or the passthrough timestamp, with days remaining and past-due status; windows PayPal does not state (chargeback-stage response, appeal period) are returned as null with a reason, never guessed. Also outputs required evidence and missing items per reason, and the evidence bundle: for a chargeback on a card-funded transaction only, a CE3.0-shaped bundle with art-297's field names kept verbatim (delivery proof from fulfillment evidence; null for ap2_mandate, tap_signature, agentic_token and prior_transactions where PayPal has no counterpart), consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic); for inquiry, claim and appeal stages, or non-card funding, a paypal_process_evidence bundle using the lib's evidence types on the Disputes API v1.12 evidence_info shape, explicitly labelled not CE3.0; for unknown funding, no CE3.0 bundle and a reason. Zero network, zero PII, synthetic values only. Clause authority: research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md (fetch 2026-10-25T03Z)."
resource: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html
tags: ["compliance_mandate", "wave-135", "mcp:compute_paypal_response"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-776-paypal-dispute-deadline-evidence.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html
    title: "public tool page"
---

# PayPal Dispute Deadline & Evidence

> Exports a decision via MCP `compute_paypal_response` — mandate type `compliance_mandate`.

**Context:** PayPal-stated windows this node computes: inquiry seller response 10 days after dispute creation (S8/S1) and a 20-day inquiry window (S1/S8). Chargeback-stage response window and appeal period length are NOT STATED by PayPal (S9, S2) and are returned as null with a reason.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-776-paypal-dispute-deadline-evidence.md) — §10.2.
