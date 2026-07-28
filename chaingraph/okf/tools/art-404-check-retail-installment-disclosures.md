---
type: DecisionTool
title: "Retail Installment Contract TILA Disclosure Checker"
description: "Ties declared retail-installment-contract Amount Financed, Finance Charge, and Total of Payments (12 CFR 1026.18) against a REUSED amortization schedule -- compose by feeding build_amortization_schedule's (art-332) output_payload straight in, or by reference via its totals and schedule_digest. Does not amortize itself. Also records a dealer-participation/markup declaration as an asserted, receipt-bound fair-lending adjacency note -- no discrimination determination is computed."
resource: https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.html
tags: ["compliance_mandate", "wave-60", "mcp:check_retail_installment_disclosures"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-404-check-retail-installment-disclosures.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.html
    title: "public tool page"
---

# Retail Installment Contract TILA Disclosure Checker

> Exports a decision via MCP `check_retail_installment_disclosures` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Amortization Schedule Builder](./art-332-build-amortization-schedule.md), [Net Present Value (NPV)](./art-324-tvm-npv.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-404-check-retail-installment-disclosures.md) — §10.2.
