---
type: DecisionTool
title: "Solo 401(k) vs. SEP-IRA Optimizer"
description: "Self-employed retirement-contribution comparator ported from ApexLogics Apex #112 (AL-119). For a tax year, net self-employment profit, age at end of tax year, marginal rate, outside-plan flag and existing elective deferrals, the node prices three retirement-vehicle ceilings under one dated set of IRS limits; Solo 401(k) (402(g) deferral + 414(v)/SECURE 2.0 catch-up + 25% employer profit sharing under 415(c)), SEP-IRA (25% of net earnings after the one-half SE-tax deduction, capped at 72,000) and SIMPLE IRA (408(p)(2)(E)(iii) salary reduction plus a 2% nonelective employer contribution); ranks them by maximum contribution with a declared tie order, reports each plan's binding cap, and returns the estimated tax saving at the caller-supplied marginal rate. The tax year is an explicit as_of input selecting the pinned LIMITS_BY_TAX_YEAR table (2026 only); any other year is a NO_LIMITS_FOR_TAX_YEAR refusal, never a silent fallback. Money is integer cents with floor division. Where Apex disagreed with the official 2026 figures the official figure won (DIFFERS.md D1: SIMPLE age-50+ catch-up 4,000 vs Apex's 5,000), a zero net income and a zero marginal rate are honoured instead of silently substituted (D2, D5), the dead existing_employer_plan input is echoed and flagged (D4), and the unreachable Solo total cap is kept for shape fidelity with its binding reported (D7)."
resource: https://ainumbers.co/chaingraph/art-764-solo-401k-vs-sep-ira.html
tags: ["compensation_assessment", "wave-134", "mcp:compare_solo401k_sep_simple"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-764-solo-401k-vs-sep-ira.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-764-solo-401k-vs-sep-ira.html
    title: "public tool page"
---

# Solo 401(k) vs. SEP-IRA Optimizer

> Exports a decision via MCP `compare_solo401k_sep_simple` — mandate type `compensation_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-764-solo-401k-vs-sep-ira.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-764-solo-401k-vs-sep-ira.md) — §10.2.
