---
type: DecisionTool
title: "Published Regulatory Report Edit-Check Runner"
description: "Evaluates a caller-supplied report instance against a caller-supplied published edit-check rule set -- FFIEC Call Report validity and quality edits (Excel/PDF, published ahead of each quarter-end, latest 2026-01-22) or the EBA ITS validation-rules list -- across seven rule shapes: intra-schedule arithmetic identity, cross-schedule tie-out, sign/domain constraint, mandatory-field completeness, closed-domain membership, conditional presence, and conditional prohibition. The three conditional shapes take a when predicate over other cells in the same row. Returns per-rule pass/fail/suppressed status keyed by the published edit id, with failing cell references and computed-vs-reported values. Accepts a deactivation/suppression list as a first-class policy input (the EBA publishes rules deactivated for inaccuracies or IT issues; this kernel never reports a failure on a stood-down rule, and records exactly which suppressions were applied plus any that are stale). Distinct from art-434-call-report-edit-check-gate, which runs a CURATED, HARDCODED battery of checks against a specific art-432/art-433 Schedule RC/RC-R output shape: this kernel bakes in no rule content at all, and evaluates whatever rule set the caller supplies against whatever report instance the caller supplies. Nothing access-gated is required to get a result."
resource: https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html
tags: ["regulatory_reporting", "wave-77", "mcp:run_regrpt_edit_checks"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-484-regrpt-editcheck-runner.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html
    title: "public tool page"
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

## Attested computation

[executor + attester binding](../computations/art-484-regrpt-editcheck-runner.md) — §10.2.
