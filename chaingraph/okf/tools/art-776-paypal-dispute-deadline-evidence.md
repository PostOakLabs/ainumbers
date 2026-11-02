---
type: DecisionTool
title: "PayPal Dispute Deadline & Evidence"
description: "Dispute deadline calculator and evidence-bundle producer across four payment service providers (PayPal default, plus Stripe, Adyen and Square via the psp input), the seller-side producer for the existing dispute-evidence chain. Each PSP contributes one deadline table as data, every rule citing its own snapshot clause, and a window the PSP does not state is returned as null with a reason, never guessed. PayPal inputs: one of the four dispute reasons in the estate's PayPal dispute-evidence map (MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED, UNAUTHORISED, CREDIT_NOT_PROCESSED, reused verbatim from paypal-agent-shop/lib/disputes.js), a lifecycle stage from PayPal's dispute_life_cycle_stage enum (INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION), a funding source, ISO-8601 UTC timestamps (dispute creation, caller-supplied as_of, optional seller_response_due_date passthrough) and the evidence items on hand. The other PSPs take their own stage vocabulary from their snapshots (Stripe's Dispute object status enum, Adyen's dispute webhook event codes with the scheme as the table key, Square's DisputeState) instead of the PayPal reason and funding vocabulary. Outputs: the seller response deadline from the selected PSP's stated rules (PayPal: 10 days after dispute creation at the inquiry stage, and a 20-day inquiry window; Adyen: the scheme timeframe matrix, for example Mastercard 40 calendar days from the notification-of-chargeback date; Stripe: a 120-day inquiry auto-close; Square: no stated rule number) or the passthrough timestamp, with days remaining and past-due status; windows a PSP states only as a range (Stripe's usually 7 to 21 days depending on the card network), a typical figure (Square's typically 14 days or less), a reason-dependent ambiguity (Adyen's Visa 9-or-18-day response split by processing region, Klarna's 14-day / 7-day / 96-hour RFI split by reason code) or not at all are returned as null with the reason quoted. Also outputs required evidence and missing items per reason on the PayPal path, and the evidence bundle: for a card-network chargeback at its response stage only (PayPal chargeback on card funding; Stripe needs_response on a card rail; Adyen notification of chargeback or chargeback on a card-network scheme; Square evidence_required, bank-initiated by definition), a CE3.0-shaped bundle with art-297's field names kept verbatim (delivery proof from fulfillment evidence; null for ap2_mandate, tap_signature, agentic_token and prior_transactions where the PSP has no counterpart), consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic); for PayPal inquiry, claim and appeal stages, or non-card funding, a paypal_process_evidence bundle using the lib's evidence types on the Disputes API v1.12 evidence_info shape, explicitly labelled not CE3.0; for unknown PayPal funding, no CE3.0 bundle and a reason. Zero network, zero PII, synthetic values only. Clause authority: research/clause-snapshots/{paypal,stripe,adyen,square}-disputes-2026-10/SNAPSHOT.md (fetches 2026-10-25T03Z and 2026-10-26T12Z)."
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

**Context:** PSP-stated windows this node computes: PayPal inquiry seller response 10 days after dispute creation (S8/S1) and a 20-day inquiry window (S1/S8); Adyen scheme matrix (NoC response: Mastercard 40, Amex 14, Diners 25, Discover 25, CUP 30, JCB 40, Affirm 15, NYCE/PULSE/Accel&STAR 30, TWINT 10 calendar days; RFI response: Amex 14, Diners 18, Discover 18, CUP 30, JCB 18, Afterpay/Clearpay 13); Stripe 120-day inquiry auto-close (S3). NOT STATED, returned null with a reason: PayPal chargeback-stage response (S9) and appeal period (S2); Stripe response window (7-21 day card-network range, S4; due-by formula, S2); Adyen Visa 9-or-18 split (A5), Klarna RFI 14/7/96h split (A5) and pre-arbitration accept window (A5); Square response window (typically 14 days or less, Q3 — per-dispute deadline is due_at, Q4).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-776-paypal-dispute-deadline-evidence.md) — §10.2.
