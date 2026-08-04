---
type: DecisionTool
title: "Reg E Remittance Disclosure Consistency Check"
description: "Deterministic recompute of the Reg E Subpart B (12 CFR 1005.31, implementing Dodd-Frank section 1073) remittance disclosure arithmetic identity: amount_received = (send_amount - total_fees) x exchange_rate. The caller supplies a provider's already-disclosed send amount, total fees, exchange rate, and recipient amount (all as integer cents / a rate scaled by 1,000,000, no floats); this kernel recomputes the identity and reports amount_recipient_recomputed, disclosure_consistent, and the exact discrepancy amount if any. Never fetches a live rate and never generates a fresh disclosure of its own -- it verifies that numbers a provider already disclosed are internally consistent. Distinct from art-248-compute-remittance-disclosure, which computes a disclosure from scratch rather than checking one against a caller-declared recipient figure."
resource: https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.html
tags: ["compliance_mandate", "wave-91", "mcp:check_reg_e_remittance_disclosure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-550-reg-e-remittance-disclosure-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.html
    title: "public tool page"
---

# Reg E Remittance Disclosure Consistency Check

> Exports a decision via MCP `check_reg_e_remittance_disclosure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-550-reg-e-remittance-disclosure-check.md) — §10.2.
