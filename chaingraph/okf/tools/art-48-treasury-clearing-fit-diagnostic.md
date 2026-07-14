---
type: DecisionTool
title: "Treasury Clearing Fit Diagnostic"
description: "12-question A-F readiness diagnostic for the SEC US Treasury clearing mandate (cash Dec 31 2026 / repo Jun 30 2027). Grades scope, access, margin capacity, capital, ops/docs, and liquidity; routes to the right treasury-clearing chain and emits a remediation checklist."
resource: https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-11", "mcp:run_treasury_clearing_fit"]
timestamp: 2026-07-14
---

# Treasury Clearing Fit Diagnostic

> Exports a decision via MCP `run_treasury_clearing_fit` — mandate type `agent_guardrail_mandate`.

**Deadline:** 2026-12-31 — SEC UST clearing: cash Dec 31 2026, repo Jun 30 2027. D0 root of all treasury-clearing chains.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Clearing Access Model Selector](./art-49-clearing-access-model-selector.md), [FICC Margin & Netting Estimator](./art-50-ficc-margin-netting-estimator.md)
