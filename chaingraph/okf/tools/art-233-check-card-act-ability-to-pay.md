---
type: DecisionTool
title: "Check CARD Act Ability to Pay"
description: "Evaluates a credit card application against CARD Act §1026.51 ability-to-pay requirements. Computes monthly minimum payment from the requested credit limit and minimum payment percentage. Checks DTI against the 45% threshold using income and assets. Applies the under-21 independent-income restriction (§1026.51(b)). Reports the §1026.52(b) penalty fee safe harbor ($32 first violation / $43 subsequent). As observed 2026-09-01: the CFPB $8 late fee rule was vacated by consent judgment on 2025-04-15 (U.S. District Court, N.D. Tex., Chamber of Commerce v. CFPB, No. 4:24-cv-00213-P); $32/$43 thresholds remain in effect."
resource: https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.html
tags: ["compliance_mandate", "wave-39", "mcp:check_card_act_ability_to_pay"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-233-check-card-act-ability-to-pay.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.html
    title: "public tool page"
---

# Check CARD Act Ability to Pay

> Exports a decision via MCP `check_card_act_ability_to_pay` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Build Adverse Action Notice](./art-228-build-adverse-action-notice.md)

## Attested computation

[executor + attester binding](../computations/art-233-check-card-act-ability-to-pay.md) — §10.2.
