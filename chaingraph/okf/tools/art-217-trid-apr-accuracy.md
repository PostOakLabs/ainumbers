---
type: DecisionTool
title: "TRID APR Accuracy Verifier"
description: "TRID APR accuracy check per Reg Z §1026.22(a). Verifies disclosed APR against actual APR within 1/8 percentage point tolerance for regular transactions or 1/4 percentage point for irregular transactions. Returns verdict: accurate, accurate_overstated_ok, understated_violation, or overstated_violation. APR understatement is a TILA violation; overstatement within tolerance is not."
resource: https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.html
tags: ["compliance_mandate", "wave-37", "mcp:verify_trid_apr_accuracy"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-217-trid-apr-accuracy.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.html
    title: "public tool page"
---

# TRID APR Accuracy Verifier

> Exports a decision via MCP `verify_trid_apr_accuracy` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Reg Z Appendix J APR Solver](./art-215-reg-z-appendix-j-apr.md)

**Feeds:** _terminal node_
