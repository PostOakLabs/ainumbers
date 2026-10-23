---
type: DecisionTool
title: "Automation Payback"
description: "Automation Payback ranker ported from ApexLogics Apex #180 (AL-194). For a list of automation candidates (hours saved per week, loaded hourly rate, error cost avoided per month, one-time build cost, monthly subscription) and three global policy parameters (maintenance haircut percent on recurring cost, evaluation horizon in months, weeks per month), the node computes each candidate's monthly reclaimable value and total cost of ownership (subscription with haircut plus straight-line amortised build), ranks candidates by descending net monthly dollars with ties preserving input order, assigns BUILD or SKIP at net >= 0, derives break-even months as build cost over the positive monthly margin excluding amortisation, and returns portfolio totals (net dollars kept and all-in, hours reclaimed over BUILD rows, horizon net), the best candidate, the fastest break-even, and an ALL_CLEAR / MIXED_LIST / NO_CANDIDATE_CLEARS verdict with an empty-list guard. Gross-dollar arithmetic over user estimates; the 20 percent haircut and the 4.33 weeks-per-month default are policy parameters kept for live-vector parity (the 52/12 quotient is UNGROUNDED), with no tax or regulatory premise (payload DIFFERS.md D-01..D-06, CITES.md)."
resource: https://ainumbers.co/chaingraph/art-771-automation-payback.html
tags: ["analytics_mandate", "wave-133", "mcp:compute_automation_payback"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-771-automation-payback.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-771-automation-payback.html
    title: "public tool page"
---

# Automation Payback

> Exports a decision via MCP `compute_automation_payback` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-771-automation-payback.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-771-automation-payback.md) — §10.2.
