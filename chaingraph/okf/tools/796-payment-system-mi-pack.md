---
type: DecisionTool
title: "Payment System MI Pack"
description: "Computes a payment system's management-information pack from declared AGGREGATE counts only (no transaction-level records, no personal data): a fixed KPI set covering speed (share of transactions credited within one hour and within one business day), average cost in basis points of transaction value, failure rate, availability from scheduled versus unplanned-downtime minutes, fraud value and count shares, complaint resolution within SLA, adoption (users per 1000 eligible population and accepting locations count), and transparency (share of services disclosing cost and speed). Each KPI carries its definition source in definition_ref: the speed percentage is compared against the pinned 75-percent-within-one-hour cross-border retail speed target on the g20_retail and fast_payment_scheme profiles; the cost, access and transparency KPI families are adapted from the pinned FSB retail KPI definitions; availability is anchored to the pinned operational-risk principle with the 99.9-percent reference level declared as a design convention; the remaining KPIs are declared design conventions. Missing-input KPIs are null with a reason code, never zero; channel totals that do not reconcile, credited counts above the declared total, negative declared values, fractional declared count fields and impossible declared relations (a part above its whole, such as resolved complaints above received, downtime above scheduled minutes, active users above the eligible population or disclosing services above total services) raise data-quality flags and the affected KPI is null with a named reason; inputs the artifact path cannot canonicalize (integers beyond 2 to the power 53, non-finite numbers), malformed channel or failure entries, wrong-typed period or prior-period values and dates that are not real calendar dates are refused; a prior period of the same shape yields per-KPI deltas. Profile-keyed (generic, g20_retail, fast_payment_scheme, gov_payments). Declared scope limit: this node produces KPIs, not verdicts, it does not reconcile individual records and does not audit statements (the reconciliation and audit nodes art-516 and art-517 do that), and it never presents real scheme figures: every figure is computed from caller-declared aggregates."
resource: https://ainumbers.co/chaingraph/796-payment-system-mi-pack.html
tags: ["compliance_control", "wave-141", "mcp:compute_payment_system_mi_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/796-payment-system-mi-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/796-payment-system-mi-pack.html
    title: "public tool page"
---

# Payment System MI Pack

> Exports a decision via MCP `compute_payment_system_mi_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/796-payment-system-mi-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/796-payment-system-mi-pack.md) — §10.2.
