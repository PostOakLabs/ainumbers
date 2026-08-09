---
type: DecisionTool
title: "Reg Z Appendix J APR Solver"
description: "Reg Z Appendix J actuarial APR solver. Bracketed bisection on the general actuarial equation (12 CFR 1026 Appendix J), with the odd-days fraction priced at simple interest per (b)(6) and only full unit-periods compounded. Handles regular and irregular payment schedules with an odd-days fractional first period, and reports a rate only when a sign-change bracket was established. Pure ECMA-262 arithmetic, no floating-point built-ins beyond basic operations. APR accuracy, TRID disclosure, and QM spread test input."
resource: https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html
tags: ["compliance_mandate", "wave-37", "mcp:compute_reg_z_appendix_j_apr"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-215-reg-z-appendix-j-apr.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html
    title: "public tool page"
---

# Reg Z Appendix J APR Solver

> Exports a decision via MCP `compute_reg_z_appendix_j_apr` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Amortization Schedule Builder](./art-332-build-amortization-schedule.md)

**Feeds:** [TRID APR Accuracy Verifier](./art-217-trid-apr-accuracy.md)

## Attested computation

[executor + attester binding](../computations/art-215-reg-z-appendix-j-apr.md) — §10.2.
