---
type: DecisionTool
title: "Cat Bond Trigger Terms Validator"
description: "Validates catastrophe bond trigger term structure and computes layer arithmetic: attachment/exhaustion point ordering, pro-rata layer penetration factor, payout amount, and layer position (BELOW_ATTACHMENT / WITHIN_LAYER / ABOVE_EXHAUSTION). Cat bonds outstanding $63.9B Q1 2026 (record $25.6B issuance 2025). Validates ISDA/IAIS trigger term constraints including attachment > 0 and exhaustion > attachment. Use in parametric-trigger-adjudication chain downstream of trigger evaluation, or standalone in cat-bond-trigger-validation chain. ZERO PII."
resource: https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.html
tags: ["compliance_mandate", "wave-43", "mcp:validate_cat_bond_trigger_terms"]
timestamp: 2026-07-14
---

# Cat Bond Trigger Terms Validator

> Exports a decision via MCP `validate_cat_bond_trigger_terms` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Parametric Trigger Payout Calculator](./art-251-compute-parametric-trigger-payout.md)

**Feeds:** _terminal node_
