---
type: DecisionTool
title: "Published Regulatory Report Edit-Check Runner"
description: "Evaluates a caller-supplied report instance against a caller-supplied published edit-check rule set -- FFIEC Call Report validity and quality edits (Excel/PDF, published ahead of each quarter-end, latest 2026-01-22) or the EBA ITS validation-rules list -- across four rule shapes: intra-schedule arithmetic identity, cross-schedule tie-out, sign/domain constraint, and mandatory-field completeness. Returns per-rule pass/fail/suppressed status keyed by the published edit id, with failing cell references and computed-vs-reported values. Accepts a deactivation/suppression list as a first-class policy input (the EBA publishes rules deactivated for inaccuracies or IT issues; this kernel never reports a failure on a stood-down rule, and records exactly which suppressions were applied plus any that are stale). Distinct from art-434-call-report-edit-check-gate, which runs a CURATED, HARDCODED battery of checks against a specific art-432/art-433 Schedule RC/RC-R output shape: this kernel bakes in no rule content at all, and evaluates whatever rule set the caller supplies against whatever report instance the caller supplies. Nothing access-gated is required to get a result."
resource: https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html
tags: ["regulatory_reporting", "wave-77", "mcp:run_regrpt_edit_checks"]
timestamp: 2026-07-14
---

# Published Regulatory Report Edit-Check Runner

> Exports a decision via MCP `run_regrpt_edit_checks` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
