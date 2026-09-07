---
type: DecisionTool
title: "APY-Earned Recompute"
description: "Recomputes the annual percentage yield earned for a periodic statement from caller-declared inputs: the interest actually earned for the period, the average daily balance (supplied directly or derived as the days-weighted mean of caller-declared balance spans), and the actual days in the period, using the compound general formula of the cited rule text (100*((1+I/B)^(365/D)-1)), and diffs the recomputed yield against the caller-supplied disclosed figure within a declared accuracy band whose 0.05pp default is the rule text's own accuracy statement. Returns MATCHES, DIVERGES with the exact difference, or INDETERMINATE when inputs are outside the declared domain or no disclosed figure exists to diff against. The statement-more-often-than-compounding special formula is declared unsupported and refused, never approximated. An independent recompute-and-receipt over caller-declared contract inputs, not an audit of or substitution for any core platform, and not a claim about what any institution should have disclosed. NOTE: the build spec's simple-annualization variant does not reproduce the cited text's own worked examples and was not implemented; the divergence is recorded in the row check-off."
resource: https://ainumbers.co/tools/663-apy-earned-recompute.html
tags: ["compliance_control", "wave-112", "mcp:compute_apy_earned_recompute"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-663-apy-earned-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/663-apy-earned-recompute.html
    title: "public tool page"
---

# APY-Earned Recompute

> Exports a decision via MCP `compute_apy_earned_recompute` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/663-apy-earned-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-663-apy-earned-recompute.md) — §10.2.
