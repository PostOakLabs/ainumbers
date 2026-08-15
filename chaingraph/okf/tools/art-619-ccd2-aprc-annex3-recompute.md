---
type: DecisionTool
title: "CCD2 Annex III APRC Recompute"
description: "Recomputes the EU Directive (EU) 2023/2225 (CCD2) annual percentage rate of charge (APRC) from a caller-supplied drawdown/repayment schedule against Annex III Part I's own present-value-equality equation, solved iteratively by bracketed bisection for the rate X. Unlike Reg Z Appendix J (art-215), Annex III's own text expresses each flow's interval directly in years and fractions of a year and raises (1+X) to that real-valued power with no integer/fraction split, so this kernel uses genuine fractional exponentiation. A rate is reported only when a sign-change bracket was established and narrowed to a declared tolerance; non-convergence and a non-bracketed schedule are both reported honestly (converged:false, bracketed:false, aprc_pct:null), never silently returned as a guess. The result is expressed to at least one decimal place per Annex III Part I remark (d), rounded half-up on the next digit. Architecturally class-C shaped (unbounded schedule arrays, iterative solver) and assigned class-B property-testing rigor by this row's own explicit ruling, not because the input domain is bounded. Verify-only recompute: does not determine which CCD2-covered agreements a caller's product falls under, does not submit anything to a regulator, and does not assert that a real agreement is or is not CCD2-compliant."
resource: https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.html
tags: ["compliance_mandate", "wave-101", "mcp:recompute_ccd2_aprc_annex3"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-619-ccd2-aprc-annex3-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.html
    title: "public tool page"
---

# CCD2 Annex III APRC Recompute

> Exports a decision via MCP `recompute_ccd2_aprc_annex3` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-619-ccd2-aprc-annex3-recompute.md) — §10.2.
