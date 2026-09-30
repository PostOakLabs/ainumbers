---
type: DecisionTool
title: "ISA 530 Audit Sampling + MUS"
description: "Deterministic audit-sampling arithmetic in three caller-declared functions dispatched on method. monetary_unit_sampling sizes a MUS engagement: n = ceil(book_value * confidence_factor / (performance_materiality - expected_misstatement)) and sampling interval = round(book_value / n), failing closed whenever expected_misstatement >= performance_materiality. misstatement_projection applies the tainting method to caller-supplied sampled items (taint = (book - audited) / book, projected misstatement = sum of taint * interval) and adds the basic-precision figure confidence_factor * interval. benford_screen compares the observed first-significant-digit distribution of caller-supplied positive amounts against the Benford expected proportions with a chi-square deviation flag at the 5% level (8 degrees of freedom, critical value 15.507). The method's source standard is ISA 530 (iaasb.org): this node computes the arithmetic of the method and never certifies compliance with any standard, never opines on audit sufficiency, and never selects sample items. No randomness of any kind: the tool performs no selection logic, and any selection start point a caller uses is a caller-declared input, never generated here. Absent, non-numeric, or out-of-domain inputs resolve to INPUT_REJECTED with the field named, never guessed or defaulted."
resource: https://ainumbers.co/chaingraph/art-693-isa530-audit-sampling-mus.html
tags: ["compliance_control", "wave-113", "mcp:compute_isa530_audit_sampling_mus"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-693-isa530-audit-sampling-mus.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-693-isa530-audit-sampling-mus.html
    title: "public tool page"
---

# ISA 530 Audit Sampling + MUS

> Exports a decision via MCP `compute_isa530_audit_sampling_mus` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-693-isa530-audit-sampling-mus.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-693-isa530-audit-sampling-mus.md) — §10.2.
