---
type: DecisionTool
title: "Reg Z Appendix J APR Solver"
description: "Reg Z Appendix J actuarial APR solver. Newton-Raphson iteration over the general actuarial equation (12 CFR 1026 Appendix J). Handles regular and irregular payment schedules with odd-days fractional first period. Pure ECMA-262 arithmetic, no floating-point built-ins beyond basic operations. APR accuracy, TRID disclosure, and QM spread test input."
resource: https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html
tags: ["compliance_mandate", "wave-37", "mcp:compute_reg_z_appendix_j_apr"]
timestamp: 2026-07-14
---

# Reg Z Appendix J APR Solver

> Exports a decision via MCP `compute_reg_z_appendix_j_apr` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [TRID APR Accuracy Verifier](./art-217-trid-apr-accuracy.md)
