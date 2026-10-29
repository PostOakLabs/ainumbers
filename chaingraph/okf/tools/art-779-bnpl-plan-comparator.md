---
type: DecisionTool
title: "BNPL Plan Comparator"
description: "Side-by-side BNPL plan cost comparison on Reg Z Appendix J APR maths, with every APR computed by art-215 compute_reg_z_appendix_j_apr (imported and delegated to, never reimplemented). Enter a USD principal plus up to 8 plans: a provider preset (labelled examples quoted from dated primary-text snapshots of PayPal, Klarna, Afterpay and Affirm US consumer pages, never an offer) or explicit parameters (instalment count, cadence weekly/biweekly/monthly, stated APR, upfront and per-instalment fees, optional quoted instalment amount). Each plan returns its payment schedule, total of payments, fee total, finance charge and the Reg Z APR of the stream, and the comparison ranks plans by total cost. Terms vary by provider, merchant and credit decision."
resource: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html
tags: ["compliance_mandate", "wave-137", "mcp:compare_bnpl_plans"]
timestamp: 2026-10-29
generated: { by: "ainumbers/generate-okf", at: "2026-10-29" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-779-bnpl-plan-comparator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html
    title: "public tool page"
---

# BNPL Plan Comparator

> Exports a decision via MCP `compare_bnpl_plans` — mandate type `compliance_mandate`.

**Context:** Preset plan shapes are labelled examples from dated provider snapshots (PayPal P1, Klarna K1/K2, Afterpay A1/A2, Affirm F1/F2, fetch 2026-10-28), never an offer. The APR for every plan, preset or custom, is computed by the estate's Reg Z Appendix J solver art-215, imported and delegated to by this node's kernel.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-779-bnpl-plan-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-779-bnpl-plan-comparator.md) — §10.2.
