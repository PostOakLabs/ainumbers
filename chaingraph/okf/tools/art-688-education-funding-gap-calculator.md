---
type: DecisionTool
title: "Education Funding Gap Calculator"
description: "Computes the arithmetic of a declared education funding plan: the future value of a declared current balance grown at a declared annual return over a declared horizon, and the funding gap against a declared goal, returning GAP_COMPUTED or GOAL_MET with a full trace. Every input is a caller-declared synthetic value; no account, plan record, market feed, or clock is read. The overfunded-to-Roth rollover note on the GOAL_MET path echoes a caller-declared lifetime rollover cap; the statutory reference for that cap is the SECURE 2.0 Act of 2022, Division T, Section 126 (Public Law 117-328, enacted 2022-12-29), which added the 529-to-Roth IRA rollover with a 35000 USD lifetime limit per beneficiary beginning 2024 (subject to a 15-year account-age rule and annual Roth contribution limits); measured 2026-09-05; derive: read Public Law 117-328, Division T, sec. 126. The kernel never recommends a contribution amount, a plan, or a rollover; it is arithmetic over declarations, not advice. The contribution solver is out of scope for v1."
resource: https://ainumbers.co/tools/688-education-funding-gap-calculator.html
tags: ["compliance_control", "wave-116", "mcp:compute_education_funding_gap_calculator"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-688-education-funding-gap-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/688-education-funding-gap-calculator.html
    title: "public tool page"
---

# Education Funding Gap Calculator

> Exports a decision via MCP `compute_education_funding_gap_calculator` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/688-education-funding-gap-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-688-education-funding-gap-calculator.md) — §10.2.
