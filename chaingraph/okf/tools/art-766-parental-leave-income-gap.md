---
type: DecisionTool
title: "Parental Leave Income Gap"
description: "Parental-leave income gap planner ported from ApexLogics Apex #131 (AL-138). From an annual base salary, an effective tax rate, monthly household and baby expenses, partner monthly take-home, current savings, an employer paid/partial leave structure, a state PFL/SDI program with 2025-vintage rate and weekly cap, a PFL duration and a total leave duration, the node computes the week-by-week leave schedule (employer pay by phase, state benefit haircut at half the tax rate, partner pass-through, a 1.05x-of-net no-windfall cap, net per week), the total income gap (sum of negative weekly nets), average monthly leave income, monthly shortfall, savings needed, and post-return recovery months (finite ceil of gap over surplus, or the 999 display sentinel when surplus is non-positive, distinguished by recovery_finite), with verdict bands at covered and half-covered. Out-of-domain inputs are rejected by throw with a named reason. State rates/caps are the Apex 2025 schedule kept verbatim for fixture parity; the official 2026 schedules differ on every state row (payload DIFFERS.md D1-D6, CITES.md G1-G6), the L351 half-rate benefit haircut is ungrounded (CITES.md U2), and the falsy-default idiom of the Apex page is deliberately not reproduced (D10), with every vintage and grounding flag carried in the output."
resource: https://ainumbers.co/chaingraph/art-766-parental-leave-income-gap.html
tags: ["career_workforce", "wave-134", "mcp:parental_leave_income_gap"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-766-parental-leave-income-gap.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-766-parental-leave-income-gap.html
    title: "public tool page"
---

# Parental Leave Income Gap

> Exports a decision via MCP `parental_leave_income_gap` — mandate type `career_workforce`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-766-parental-leave-income-gap.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-766-parental-leave-income-gap.md) — §10.2.
